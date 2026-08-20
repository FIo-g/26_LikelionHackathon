import { spawn } from "node:child_process";
import { buildE2eServerArguments } from "./e2e-server-arguments.mjs";
import { resolveE2eLaunchEnvironment } from "./e2e-launch-config.mjs";

const port = process.env.E2E_PORT ?? "3000";
let env;
try {
  env = resolveE2eLaunchEnvironment(process.env);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "INVALID_E2E_LAUNCH"}\n`);
  process.exitCode = 1;
}

if (process.exitCode) process.exit();

const child = spawn(process.execPath, buildE2eServerArguments(env.VISUAL_TEST === "1", port), {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
