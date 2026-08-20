import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("verify:auth-schema must be run through npm");
execFileSync(process.execPath, [
  npmCli,
  "exec",
  "--",
  "auth",
  "generate",
  "--yes",
  "--config",
  "src/shared/auth/auth.ts",
  "--output",
  "prisma/schema.auth-check.prisma",
], {
  stdio: "inherit",
  env: {
    ...process.env,
    AUTH_RATE_LIMIT_ENABLED: "true",
  },
});

const [canonical, generated] = await Promise.all([
  readFile("prisma/schema.prisma", "utf8"),
  readFile("prisma/schema.auth-check.prisma", "utf8"),
]);
const names = ["User", "Session", "Account", "Verification", "RateLimit"] as const;
const modelBlock = (source: string, name: string): string => {
  const match = source.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`missing auth model: ${name}`);
  return match[1];
};
const lines = (block: string): Set<string> => new Set(
  block.split("\n").map((line) => line.replace(/\/\/.*$/, "").trim().replace(/\s+/g, " ")).filter(Boolean),
);

const fields = (block: string): Map<string, string> => {
  const result = new Map<string, string>();
  for (const line of lines(block)) {
    const match = line.match(/^(\w+) ([A-Za-z]\w*)(?:\?|\[\])?(?: |$)/);
    if (match) result.set(match[1], match[2]);
  }
  return result;
};

for (const name of names) {
  const expected = fields(modelBlock(generated, name));
  const actual = fields(modelBlock(canonical, name));
  const incompatible = [...expected].filter(([field, type]) => actual.get(field) !== type);
  if (incompatible.length) {
    throw new Error(`${name} auth schema drift:\n${incompatible.map(([field, type]) => `${field} ${type}`).join("\n")}`);
  }
}

const canonicalUser = lines(modelBlock(canonical, "User"));
if (![...canonicalUser].some((line) => /^email String\?? .*@unique(?: |$)/.test(line))) {
  throw new Error("User.email must be unique for Better Auth");
}
const canonicalSession = lines(modelBlock(canonical, "Session"));
if (![...canonicalSession].some((line) => /^token String .*@unique(?: |$)/.test(line))) {
  throw new Error("Session.token must be unique for Better Auth");
}
const canonicalAccount = lines(modelBlock(canonical, "Account"));
if (![...canonicalAccount].some((line) => line.startsWith("@@unique([issuer, accountId]"))) {
  throw new Error("Account must uniquely identify issuer/accountId pairs");
}
const canonicalRateLimit = lines(modelBlock(canonical, "RateLimit"));
if (![...canonicalRateLimit].some((line) => /^key String .*@unique(?: |$)/.test(line))) {
  throw new Error("RateLimit.key must be unique for Better Auth");
}

const directOwnershipRelations = new Map([
  ["UserProfile", "user User @relation(fields: [userId], references: [id], onDelete: Cascade)"],
  ["SleepGoal", "user User @relation(fields: [userId], references: [id], onDelete: Cascade)"],
  ["UserHabit", "user User @relation(fields: [userId], references: [id], onDelete: Cascade)"],
  ["Connection", "user User @relation(fields: [userId], references: [id], onDelete: Cascade)"],
] as const);
for (const [name, relation] of directOwnershipRelations) {
  if (!lines(modelBlock(canonical, name)).has(relation)) {
    throw new Error(`${name} is not owned by User with cascade deletion`);
  }
}

const userRelations = canonicalUser;
for (const relation of [
  "profile UserProfile?",
  "sleepGoal SleepGoal?",
  "habit UserHabit?",
  "connection Connection?",
] as const) {
  if (!userRelations.has(relation)) throw new Error(`User is missing reverse ownership relation: ${relation}`);
}

execFileSync(process.execPath, [
  npmCli,
  "exec",
  "--",
  "prisma",
  "validate",
  "--schema",
  "prisma/schema.prisma",
], { stdio: "inherit" });

await rm("prisma/schema.auth-check.prisma", { force: true });
