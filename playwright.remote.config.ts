import { defineConfig, devices } from "@playwright/test";

const suppliedBaseUrl = process.env.BASE_URL;
if (!suppliedBaseUrl) {
  throw new Error("BASE_URL is required for the remote preview smoke project");
}
const remoteOrigin = new URL(suppliedBaseUrl);
if (remoteOrigin.protocol !== "https:" || !remoteOrigin.hostname.endsWith(".vercel.app")) {
  throw new Error("BASE_URL must be an HTTPS .vercel.app origin");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /production-smoke\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: remoteOrigin.origin,
    trace: "on-first-retry",
    timezoneId: "Asia/Seoul",
  },
  projects: [{ name: "preview-smoke" }],
});
