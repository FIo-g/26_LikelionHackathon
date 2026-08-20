export const E2E_DATABASE_URL_ENV = "ADAPTIVE_SLEEP_E2E_DATABASE_URL";

const isDedicatedSqliteE2eDatabaseUrl = (value) => (
  value.startsWith("file:")
  && /(?:e2e|playwright)/i.test(value)
  && !/(?:prod(?:uction)?|dev(?:elopment)?|shared|staging|main|default)/i.test(value)
);

const isDedicatedPostgresE2eDatabaseUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "postgresql:"
      && ["127.0.0.1", "localhost"].includes(url.hostname)
      && url.pathname === "/planner_test"
      && /^(?:e2e|playwright)[-_a-z0-9]*$/i.test(url.searchParams.get("schema") ?? "");
  } catch {
    return false;
  }
};

export const isDedicatedE2eDatabaseUrl = (value) => (
  isDedicatedSqliteE2eDatabaseUrl(value) || isDedicatedPostgresE2eDatabaseUrl(value)
);

export const resolveE2eLaunchEnvironment = (source) => {
  if (Object.prototype.hasOwnProperty.call(source, "VERCEL_ENV") && source.VERCEL_ENV !== undefined) {
    throw new Error("E2E_LAUNCH_FORBIDDEN_ON_VERCEL");
  }

  const databaseUrl = source[E2E_DATABASE_URL_ENV];
  if (typeof databaseUrl !== "string" || !databaseUrl.trim()) {
    throw new Error("E2E_DATABASE_URL_REQUIRED");
  }
  if (!isDedicatedE2eDatabaseUrl(databaseUrl.trim())) {
    throw new Error("INVALID_E2E_DATABASE_URL");
  }

  const runtimeKeys = ["PATH", "HOME", "TMPDIR", "SYSTEMROOT", "WINDIR"];
  const runtimeEnvironment = Object.fromEntries(runtimeKeys.flatMap((key) => {
    const value = source[key];
    return typeof value === "string" && value ? [[key, value]] : [];
  }));
  const visualTest = source.VISUAL_TEST === "1";

  return {
    ...runtimeEnvironment,
    NODE_ENV: "test",
    ADAPTIVE_SLEEP_E2E_TEST_MODE: "1",
    DATABASE_URL: databaseUrl.trim(),
    BETTER_AUTH_SECRET: "adaptive-sleep-e2e-test-secret-2026-only",
    ...(visualTest ? {
      VISUAL_TEST: "1",
    } : {}),
  };
};
