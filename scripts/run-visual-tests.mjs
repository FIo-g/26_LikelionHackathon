import { spawnSync } from "node:child_process";
import { resolveE2eLaunchEnvironment } from "./e2e-launch-config.mjs";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("test:visual must be run through npm");
const updateBaselines = process.argv.slice(2).includes("--update-snapshots");
const launchEnvironment = resolveE2eLaunchEnvironment({ ...process.env, VISUAL_TEST: "1" });
const result = spawnSync(process.execPath, [
  npmCli,
  "exec",
  "--",
  "playwright",
  "test",
  "--config=playwright.config.ts",
  "--project=visual",
  ...process.argv.slice(2),
], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...launchEnvironment,
    ...(updateBaselines ? { ADAPTIVE_SLEEP_UPDATE_VISUAL_BASELINES: "1" } : {}),
  },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
