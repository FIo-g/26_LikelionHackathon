import { readFile } from "node:fs/promises";

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
for (const name of names) {
  const expected = lines(modelBlock(generated, name));
  const actual = lines(modelBlock(canonical, name));
  const missing = [...expected].filter((line) => !actual.has(line));
  if (missing.length) throw new Error(`${name} auth schema drift:\n${missing.join("\n")}`);
}
