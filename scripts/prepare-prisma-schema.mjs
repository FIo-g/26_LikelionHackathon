import { readFile, writeFile } from "node:fs/promises";

const optionValue = (name) => {
  const optionIndex = process.argv.indexOf(name);
  return optionIndex === -1 ? undefined : process.argv[optionIndex + 1];
};

const provider = optionValue("--provider");
if (!new Set(["sqlite", "postgresql"]).has(provider)) {
  throw new Error("--provider must be sqlite or postgresql");
}
const output = optionValue("--output") ?? "prisma/schema.active.prisma";
if (!output.trim()) throw new Error("--output must name a schema file");

const source = await readFile("prisma/schema.prisma", "utf8");
const blocks = [...source.matchAll(/datasource\s+\w+\s*\{[\s\S]*?\n\}/g)];
if (blocks.length !== 1) {
  throw new Error(`expected one datasource block, found ${blocks.length}`);
}
const block = blocks[0][0];
const providerLines = [...block.matchAll(/(^\s*provider\s*=\s*")[^"]+("\s*$)/gm)];
if (providerLines.length !== 1) {
  throw new Error(`expected one datasource provider, found ${providerLines.length}`);
}
const nextBlock = block.replace(/(^\s*provider\s*=\s*")[^"]+("\s*$)/m, `$1${provider}$2`);
await writeFile(output, source.replace(block, nextBlock));
