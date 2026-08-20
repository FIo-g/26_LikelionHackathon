import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const safeSqlitePath = (databaseUrl) => {
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("file:")) {
    throw new Error("SQLITE_MIGRATION_DATABASE_URL_REQUIRED");
  }
  const path = resolve(fileURLToPath(new URL(databaseUrl, pathToFileURL(`${process.cwd()}/`))));
  if (!/(?:contract|e2e|playwright)/i.test(path) || /(?:prod(?:uction)?|development|shared|staging|main|default)/i.test(path)) {
    throw new Error("UNSAFE_SQLITE_MIGRATION_TARGET");
  }
  return path;
};

export const applySqliteMigrations = (databaseUrl) => {
  const databasePath = safeSqlitePath(databaseUrl);
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  try {
    database.exec("PRAGMA foreign_keys=ON");
    database.exec('CREATE TABLE IF NOT EXISTS "_adaptive_sleep_migrations" ("name" TEXT NOT NULL PRIMARY KEY, "sha256" TEXT NOT NULL)');
    const applied = new Map(database.prepare('SELECT "name", "sha256" FROM "_adaptive_sleep_migrations"').all().map((row) => [row.name, row.sha256]));
    const userTable = database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'User'").get().count;
    if (Number(userTable) > 0 && applied.size === 0) throw new Error("SQLITE_SCHEMA_WITHOUT_MIGRATION_HISTORY");

    const migrationRoot = resolve("prisma/migrations-sqlite");
    const migrations = readdirSync(migrationRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ name: entry.name, path: resolve(migrationRoot, entry.name, "migration.sql") }))
      .filter((entry) => existsSync(entry.path))
      .sort((left, right) => left.name.localeCompare(right.name));
    if (migrations.length === 0) throw new Error("SQLITE_MIGRATION_HISTORY_EMPTY");

    for (const migration of migrations) {
      const sql = readFileSync(migration.path, "utf8");
      const sha256 = createHash("sha256").update(sql).digest("hex");
      const previous = applied.get(migration.name);
      if (previous === sha256) continue;
      if (previous) throw new Error(`SQLITE_MIGRATION_DRIFT:${migration.name}`);
      database.exec("BEGIN IMMEDIATE");
      try {
        database.exec(sql);
        database.prepare('INSERT INTO "_adaptive_sleep_migrations" ("name", "sha256") VALUES (?, ?)').run(migration.name, sha256);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
  } finally {
    database.close();
  }
  return databasePath;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = applySqliteMigrations(process.env.DATABASE_URL);
  process.stdout.write(`SQLite migrations current: ${path}\n`);
}
