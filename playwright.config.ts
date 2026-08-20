import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    timezoneId: "Asia/Seoul",
  },
  webServer: {
    command: "node scripts/start-e2e-server.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "visual",
      testMatch: /visual\/.*\.spec\.ts/,
      snapshotPathTemplate: "{testDir}/visual/__screenshots__/{projectName}/{arg}{ext}",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
        reducedMotion: "reduce",
        timezoneId: "Asia/Seoul",
      },
    },
  ],
});
