import { isDedicatedE2eDatabaseUrl } from "../../../scripts/e2e-launch-config.mjs";

export const isIsolatedE2eTestMode = (): boolean => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  return process.env.ADAPTIVE_SLEEP_E2E_TEST_MODE === "1"
    && !Object.prototype.hasOwnProperty.call(process.env, "VERCEL_ENV")
    && typeof databaseUrl === "string"
    && isDedicatedE2eDatabaseUrl(databaseUrl);
};
