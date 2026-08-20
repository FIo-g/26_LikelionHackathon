import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "pg";

type MigrationConnection = Readonly<{
  execute: (sql: string) => Promise<void>;
  count: (sql: string) => Promise<number>;
}>;

const checkConstraints = [
  "Narration_exactly_one_target_check",
  "PlanRevision_trigger_pair_check",
  "ScheduleAdvice_target_matches_trigger_check",
  "SleepPlan_active_key_check",
  "PlanDay_active_key_check",
  "AnalysisSnapshot_current_key_check",
  "BaselineSnapshot_current_key_check",
] as const;

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("verify:migrations must be run through npm");
const runPrisma = (args: string[], environment: NodeJS.ProcessEnv): void => {
  execFileSync(process.execPath, [npmCli, "exec", "--", "prisma", ...args], {
    stdio: "inherit",
    env: environment,
  });
};

const expectConstraintFailure = async (
  connection: MigrationConnection,
  sql: string,
  label: string,
): Promise<void> => {
  try {
    await connection.execute(sql);
  } catch {
    return;
  }
  throw new Error(`${label} accepted invalid data`);
};

const verifyObservableConstraints = async (connection: MigrationConnection): Promise<void> => {
  const timestamp = "2026-08-20T00:00:00.000Z";
  for (const [id, email] of [["owner", "owner@example.test"], ["other", "other@example.test"]]) {
    await connection.execute(`INSERT INTO "User" ("id", "email", "emailVerified", "createdAt", "updatedAt") VALUES ('${id}', '${email}', false, '${timestamp}', '${timestamp}')`);
  }

  await connection.execute(`INSERT INTO "UserProfile" ("id", "userId", "nickname", "timezone", "createdAt", "updatedAt") VALUES ('profile', 'owner', 'Owner', 'Asia/Seoul', '${timestamp}', '${timestamp}')`);
  await connection.execute(`INSERT INTO "SleepGoal" ("id", "userId", "targetBedTime", "targetWakeTime", "targetDurationMinutes", "createdAt", "updatedAt") VALUES ('goal', 'owner', '23:00', '07:00', 480, '${timestamp}', '${timestamp}')`);
  await connection.execute(`INSERT INTO "UserHabit" ("id", "userId", "caffeine", "exercise", "meal", "phoneUsage", "createdAt", "updatedAt") VALUES ('habit', 'owner', 'none', 'rare', 'mixed', 'low', '${timestamp}', '${timestamp}')`);
  await connection.execute(`INSERT INTO "Connection" ("id", "userId", "selected", "mode", "availability", "state", "createdAt", "updatedAt") VALUES ('connection', 'owner', 'manual', 'manual', 'available', 'complete', '${timestamp}', '${timestamp}')`);
  await connection.execute(`INSERT INTO "AnalysisSnapshot" ("id", "userId", "localDate", "timezone", "status", "result", "generatedAt") VALUES ('snapshot', 'owner', '2026-08-20', 'Asia/Seoul', 'historical', '{}', '${timestamp}')`);
  await connection.execute(`INSERT INTO "ImpactFactor" ("id", "userId", "analysisSnapshotId", "factor", "exposedCount", "unexposedCount", "confidence", "evidence") VALUES ('impact', 'owner', 'snapshot', 'caffeine', 1, 1, 'low', '{}')`);
  await connection.execute(`INSERT INTO "SleepPlan" ("id", "userId", "timezone", "status", "activeKey", "createdAt", "updatedAt") VALUES ('plan', 'owner', 'Asia/Seoul', 'active', 'owner:active', '${timestamp}', '${timestamp}')`);
  await connection.execute(`INSERT INTO "PlanDay" ("id", "userId", "planId", "localDate", "timezone", "targetBedAt", "targetWakeAt", "caffeineCutoffAt", "exerciseCutoffAt", "mealCutoffAt", "windDownAt", "status", "activeKey", "createdAt", "updatedAt") VALUES ('day', 'owner', 'plan', '2026-08-20', 'Asia/Seoul', '${timestamp}', '${timestamp}', '${timestamp}', '${timestamp}', '${timestamp}', '${timestamp}', 'active', 'plan:2026-08-20', '${timestamp}', '${timestamp}')`);
  await connection.execute(`INSERT INTO "SpecialEvent" ("id", "userId", "title", "type", "startsAt", "localDate", "timezone", "createdAt", "updatedAt") VALUES ('event', 'owner', 'Event', 'travel', '${timestamp}', '2026-08-20', 'Asia/Seoul', '${timestamp}', '${timestamp}')`);
  await connection.execute(`INSERT INTO "ScheduleAdvice" ("id", "userId", "eventId", "triggerType", "status", "algorithmVersion", "inputHash", "inputSnapshot", "proposal", "confidence", "generatedAt") VALUES ('advice', 'owner', 'event', 'event', 'pending', 'test', 'event-hash', '{}', '{}', 'low', '${timestamp}')`);

  await expectConstraintFailure(
    connection,
    `INSERT INTO "ImpactFactor" ("id", "userId", "analysisSnapshotId", "factor", "exposedCount", "unexposedCount", "confidence", "evidence") VALUES ('foreign-impact', 'other', 'snapshot', 'phone', 1, 1, 'low', '{}')`,
    "ImpactFactor same-user parent constraint",
  );
  await expectConstraintFailure(
    connection,
    `INSERT INTO "RoutineCompletion" ("id", "userId", "localDate", "planDayId", "routineRevisionKey", "stepKey", "completedAt", "createdAt") VALUES ('foreign-routine', 'other', '2026-08-20', 'day', 'plan', 'wind-down', '${timestamp}', '${timestamp}')`,
    "RoutineCompletion same-user parent constraint",
  );
  await expectConstraintFailure(
    connection,
    `INSERT INTO "Narration" ("id", "userId", "scheduleAdviceId", "provider", "inputHash", "facts", "status", "generatedAt", "createdAt", "updatedAt") VALUES ('foreign-narration', 'other', 'advice', 'template', 'foreign', '{}', 'complete', '${timestamp}', '${timestamp}', '${timestamp}')`,
    "Narration same-user parent constraint",
  );
  await expectConstraintFailure(
    connection,
    `INSERT INTO "Narration" ("id", "userId", "provider", "inputHash", "facts", "status", "generatedAt", "createdAt", "updatedAt") VALUES ('no-target', 'owner', 'template', 'none', '{}', 'complete', '${timestamp}', '${timestamp}', '${timestamp}')`,
    "Narration exactly-one-target constraint",
  );
  await expectConstraintFailure(
    connection,
    `INSERT INTO "Narration" ("id", "userId", "analysisSnapshotId", "scheduleAdviceId", "provider", "inputHash", "facts", "status", "generatedAt", "createdAt", "updatedAt") VALUES ('both-targets', 'owner', 'snapshot', 'advice', 'template', 'both', '{}', 'complete', '${timestamp}', '${timestamp}', '${timestamp}')`,
    "Narration mutually-exclusive-target constraint",
  );
  await expectConstraintFailure(
    connection,
    `INSERT INTO "BaselineSnapshot" ("id", "userId", "timezone", "status", "result", "generatedAt") VALUES ('invalid-baseline', 'owner', 'Asia/Seoul', 'current', '{}', '${timestamp}')`,
    "BaselineSnapshot current-key constraint",
  );
  await expectConstraintFailure(
    connection,
    `INSERT INTO "AnalysisSnapshot" ("id", "userId", "localDate", "timezone", "status", "result", "generatedAt") VALUES ('invalid-analysis', 'owner', '2026-08-20', 'Asia/Seoul', 'current', '{}', '${timestamp}')`,
    "AnalysisSnapshot current-key constraint",
  );
  await expectConstraintFailure(
    connection,
    `INSERT INTO "SleepPlan" ("id", "userId", "timezone", "status", "createdAt", "updatedAt") VALUES ('invalid-plan', 'owner', 'Asia/Seoul', 'active', '${timestamp}', '${timestamp}')`,
    "SleepPlan active-key constraint",
  );
  await expectConstraintFailure(
    connection,
    `INSERT INTO "PlanDay" ("id", "userId", "planId", "localDate", "timezone", "targetBedAt", "targetWakeAt", "caffeineCutoffAt", "exerciseCutoffAt", "mealCutoffAt", "windDownAt", "status", "createdAt", "updatedAt") VALUES ('invalid-day', 'owner', 'plan', '2026-08-21', 'Asia/Seoul', '${timestamp}', '${timestamp}', '${timestamp}', '${timestamp}', '${timestamp}', '${timestamp}', 'active', '${timestamp}', '${timestamp}')`,
    "PlanDay active-key constraint",
  );
  await expectConstraintFailure(
    connection,
    `INSERT INTO "ScheduleAdvice" ("id", "userId", "triggerType", "status", "algorithmVersion", "inputHash", "inputSnapshot", "proposal", "confidence", "generatedAt") VALUES ('invalid-advice', 'owner', 'event', 'pending', 'test', 'invalid', '{}', '{}', 'low', '${timestamp}')`,
    "ScheduleAdvice target constraint",
  );
  await expectConstraintFailure(
    connection,
    `INSERT INTO "PlanRevision" ("id", "userId", "planId", "triggerType", "triggerEntityType", "beforeSnapshot", "afterSnapshot", "reason", "createdAt") VALUES ('invalid-revision', 'owner', 'plan', 'event', 'event', '{}', '{}', 'invalid', '${timestamp}')`,
    "PlanRevision trigger-pair constraint",
  );

  await connection.execute(`DELETE FROM "User" WHERE "id" = 'owner'`);
  for (const table of ["UserProfile", "SleepGoal", "UserHabit", "Connection", "ImpactFactor"] as const) {
    if (await connection.count(`SELECT COUNT(*) AS "count" FROM "${table}" WHERE "userId" = 'owner'`) !== 0) {
      throw new Error(`${table} did not cascade after direct User deletion`);
    }
  }
};

const migrationFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    const migrationPath = join(directory, entry.name, "migration.sql");
    try {
      await readFile(migrationPath, "utf8");
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
    paths.push(migrationPath);
  }
  if (paths.length === 0) throw new Error(`no migrations found under ${directory}`);
  return paths;
};

const verifySqliteHistory = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "adaptive-sleep-migrations-"));
  const database = new DatabaseSync(join(directory, "migration-test.sqlite"));
  try {
    database.exec("PRAGMA foreign_keys=ON");
    for (const migration of await migrationFiles("prisma/migrations-sqlite")) {
      database.exec(await readFile(migration, "utf8"));
    }
    const connection: MigrationConnection = {
      execute: async (sql) => { database.exec(sql); },
      count: async (sql) => Number((database.prepare(sql).get() as { count: number | bigint }).count),
    };
    await verifyObservableConstraints(connection);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
  console.log("SQLite migration history verified on a fresh database.");
};

const verifyPostgresqlHistory = async (rawUrl: string): Promise<void> => {
  const url = new URL(rawUrl);
  const schema = url.searchParams.get("schema");
  if (!(url.protocol === "postgresql:" && ["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/planner_test" && schema === "migration_verification")) {
    throw new Error("verify:migrations accepts only local planner_test?schema=migration_verification");
  }

  const [lock, sql] = await Promise.all([
    readFile("prisma/migrations/migration_lock.toml", "utf8"),
    readFile("prisma/migrations/20260819000000_initial_postgresql/migration.sql", "utf8"),
  ]);
  if (lock.trim() !== 'provider = "postgresql"') throw new Error("unexpected migration provider lock");
  for (const name of checkConstraints) {
    if (!sql.includes(name)) throw new Error(`missing PostgreSQL constraint: ${name}`);
  }
  if (/\b(DROP\s+TABLE|TRUNCATE|PRAGMA|AUTOINCREMENT)\b/i.test(sql)) {
    throw new Error("unsafe or SQLite SQL in release migration");
  }

  const adminUrl = new URL(url);
  adminUrl.searchParams.delete("schema");
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query('DROP SCHEMA IF EXISTS "migration_verification" CASCADE');
    await admin.query('CREATE SCHEMA "migration_verification"');
  } finally {
    await admin.end();
  }

  const prismaEnvironment = { ...process.env, DATABASE_URL: rawUrl, MIGRATION_DATABASE_URL: rawUrl };
  runPrisma(["migrate", "deploy"], prismaEnvironment);
  const client = new Client({
    connectionString: adminUrl.toString(),
    options: "-c search_path=migration_verification",
  });
  await client.connect();
  try {
    const result = await client.query<{ conname: string }>(
      `SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE n.nspname = $1 AND c.conname = ANY($2::text[])`,
      [schema, checkConstraints],
    );
    if (new Set(result.rows.map(({ conname }) => conname)).size !== checkConstraints.length) {
      throw new Error("PostgreSQL constraints do not match migration");
    }
    await verifyObservableConstraints({
      execute: async (sql) => { await client.query(sql); },
      count: async (sql) => Number((await client.query<{ count: string }>(sql)).rows[0]?.count ?? Number.NaN),
    });
  } finally {
    await client.end();
  }
  runPrisma(["migrate", "status"], prismaEnvironment);
  console.log("PostgreSQL migration history verified on a fresh local schema.");
};

await verifySqliteHistory();

const databaseUrl = process.env.DATABASE_URL?.trim();
const isPostgresqlUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "postgresql:";
  } catch {
    return false;
  }
};
if (databaseUrl && isPostgresqlUrl(databaseUrl)) {
  await verifyPostgresqlHistory(databaseUrl);
} else {
  console.log("PostgreSQL migration verification skipped: DATABASE_URL is not configured.");
}
