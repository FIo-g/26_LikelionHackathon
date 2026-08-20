import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const minimumBodyTextContrast = 4.5;

const files = {
  account: readFileSync(join(process.cwd(), "src/modules/account/ui/account.module.css"), "utf8"),
  analyze: readFileSync(join(process.cwd(), "src/modules/analysis/ui/analyze.module.css"), "utf8"),
  care: readFileSync(join(process.cwd(), "src/modules/care/ui/care.module.css"), "utf8"),
};

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
};

const relativeLuminance = (hex: string) => {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const [red, green, blue] = hexToRgb(hex).map(channel);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (foreground: string, background: string) => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const declarationsFor = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|})\\s*[^{}]*${escaped}[^{}]*\\{([^}]*)\\}`, "m").exec(css);
  if (!match) throw new Error(`Missing selector ${selector}`);
  return match[1];
};

const colorFor = (css: string, selector: string, property: "background" | "color") => {
  const declarations = declarationsFor(css, selector);
  const match = new RegExp(`${property}\\s*:\\s*(#[0-9a-fA-F]{6}|white)\\b`).exec(declarations);
  if (!match) throw new Error(`Missing ${property} declaration for ${selector}`);
  return match[1] === "white" ? "#ffffff" : match[1].toLowerCase();
};

describe("CSS color contrast contracts", () => {
  it("keeps analyze insufficient status text readable on metric cards", () => {
    expect(contrastRatio(
      colorFor(files.analyze, ".status_insufficient", "color"),
      colorFor(files.analyze, ".metricCard", "background"),
    )).toBeGreaterThanOrEqual(minimumBodyTextContrast);
  });

  it("keeps care secondary stop buttons readable", () => {
    expect(contrastRatio(
      colorFor(files.care, ".toolCard button", "color"),
      colorFor(files.care, ".toolCard button + button", "background"),
    )).toBeGreaterThanOrEqual(minimumBodyTextContrast);
  });

  it("keeps account privacy notes readable on cards", () => {
    expect(contrastRatio(
      colorFor(files.account, ".privacyNote", "color"),
      "#ffffff",
    )).toBeGreaterThanOrEqual(minimumBodyTextContrast);
  });
});
