import { createHash } from "node:crypto";

import { JsonContractError } from "@/shared/validation/errors";

type JsonObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is JsonObject => (
  value !== null && typeof value === "object" && !Array.isArray(value)
);

const canonicalizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item));
  }

  if (!isPlainObject(value)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new JsonContractError("INVALID_JSON_VALUE");
    }

    return value;
  }

  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalizeValue(item)] as const);

  return Object.fromEntries(entries);
};

export const canonicalize = (value: unknown): unknown => canonicalizeValue(value);

export const hashCanonicalJson = (value: unknown): string => {
  const canonical = canonicalize(value);
  let serialized: string | undefined;

  try {
    serialized = JSON.stringify(canonical);
  } catch {
    throw new JsonContractError("INVALID_JSON_VALUE");
  }

  if (serialized === undefined) {
    throw new JsonContractError("INVALID_JSON_VALUE");
  }

  return createHash("sha256").update(serialized, "utf8").digest("hex");
};
