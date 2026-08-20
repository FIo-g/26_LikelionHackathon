import { describe, expect, it } from "vitest";

import { assertJsonSize, parseVersionedJson } from "@/shared/validation/versioned-json";
import { JsonContractError } from "@/shared/validation/errors";

describe("versioned-json", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseVersionedJson("not json")).toThrow(JsonContractError);
    expect(() => parseVersionedJson("not json")).toThrow("INVALID_JSON_VALUE");
  });

  it("rejects unknown schema version", () => {
    expect(() => parseVersionedJson(JSON.stringify({ schemaVersion: 2, text: "x" }))).toThrow("UNKNOWN_SCHEMA_VERSION");
  });

  it("rejects oversized payload", () => {
    expect(() => assertJsonSize({ schemaVersion: 1, text: "x".repeat(70_000) })).toThrow("JSON_TOO_LARGE");
  });

  it("parses a versioned payload", () => {
    expect(parseVersionedJson(JSON.stringify({ schemaVersion: 1, text: "ok" }))).toEqual({
      schemaVersion: 1,
      text: "ok",
    });
  });
});
