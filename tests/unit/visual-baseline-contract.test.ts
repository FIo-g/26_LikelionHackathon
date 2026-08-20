import { readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { VISUAL_FRAMES } from "../visual/manifest";

const baselineDirectory = "tests/visual/__screenshots__/visual";

const committedBaselineNames = async (): Promise<string[]> => {
  try {
    return (await readdir(baselineDirectory))
      .filter((name) => name.endsWith(".png"))
      .sort();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
};

describe("visual baseline contract", () => {
  it("requires exactly one committed baseline per manifest frame", async () => {
    const expected = VISUAL_FRAMES.map(({ name }) => `${name}.png`).sort();

    await expect(committedBaselineNames()).resolves.toEqual(expected);
  });
});
