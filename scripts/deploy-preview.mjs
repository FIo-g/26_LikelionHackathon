import { execFileSync } from "node:child_process";

const stdout = execFileSync("npm", ["exec", "--", "vercel", "deploy", "--prebuilt", "--yes"], {
  encoding: "utf8",
  stdio: ["inherit", "pipe", "inherit"],
});
const candidates = stdout.match(/https:\/\/[^\s]+\.vercel\.app\/?/g) ?? [];
const deployed = candidates.at(-1);
if (!deployed) throw new Error("Vercel did not return a deployment URL");
const url = new URL(deployed);
if (url.protocol !== "https:" || !url.hostname.endsWith(".vercel.app")) {
  throw new Error("unexpected deployment origin");
}
execFileSync("npm", ["exec", "--", "playwright", "test", "--config", "playwright.remote.config.ts", "--project", "preview-smoke"], {
  stdio: "inherit",
  env: { ...process.env, BASE_URL: url.origin },
});
