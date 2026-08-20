import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { Client } from "pg";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL is required");
const url = new URL(rawUrl);
const schema = url.searchParams.get("schema");
if (!(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/planner_test" && schema === "migration_verification")) {
  throw new Error("verify:migrations accepts only local planner_test?schema=migration_verification");
}

const migrationPath = "prisma/migrations/20260819000000_initial_postgresql/migration.sql";
const [lock, sql] = await Promise.all([
  readFile("prisma/migrations/migration_lock.toml", "utf8"),
  readFile(migrationPath, "utf8"),
]);
if (lock.trim() !== 'provider = "postgresql"') throw new Error("unexpected migration provider lock");
const constraints = [
  "Narration_exactly_one_target_check",
  "PlanRevision_trigger_pair_check",
  "ScheduleAdvice_target_matches_trigger_check",
  "SleepPlan_active_key_check",
  "PlanDay_active_key_check",
  "AnalysisSnapshot_current_key_check",
  "BaselineSnapshot_current_key_check",
] as const;
for (const name of constraints) {
  if (!sql.includes(name)) throw new Error(`missing constraint: ${name}`);
}
if (/\b(DROP\s+TABLE|TRUNCATE|PRAGMA|AUTOINCREMENT)\b/i.test(sql)) {
  throw new Error("unsafe or SQLite SQL in release migration");
}

const adminUrl = new URL(url);
adminUrl.searchParams.delete("schema");
const client = new Client({ connectionString: adminUrl.toString() });
await client.connect();
try {
  await client.query('DROP SCHEMA IF EXISTS "migration_verification" CASCADE');
  await client.query('CREATE SCHEMA "migration_verification"');
} finally {
  await client.end();
}

const prismaEnvironment = { ...process.env, DATABASE_URL: rawUrl, MIGRATION_DATABASE_URL: rawUrl };
execFileSync("npm", ["exec", "--", "prisma", "migrate", "deploy"], { stdio: "inherit", env: prismaEnvironment });
const verify = new Client({ connectionString: adminUrl.toString() });
await verify.connect();
try {
  const result = await verify.query<{ conname: string }>(
    `SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = $1 AND c.conname = ANY($2::text[])`,
    [schema, constraints],
  );
  if (new Set(result.rows.map(({ conname }) => conname)).size !== constraints.length) {
    throw new Error("database constraints do not match migration");
  }
} finally {
  await verify.end();
}
execFileSync("npm", ["exec", "--", "prisma", "migrate", "status"], { stdio: "inherit", env: prismaEnvironment });
