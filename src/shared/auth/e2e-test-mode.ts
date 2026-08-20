export const isIsolatedE2eTestMode = (): boolean => (
  process.env.NODE_ENV === "test"
  && process.env.ADAPTIVE_SLEEP_E2E_TEST_MODE === "1"
  && !process.env.VERCEL_ENV
);
