import { describe, expect, it } from "vitest";

import { assertJsonSize, parseVersionedJson } from "@/shared/validation/versioned-json";
import { JsonContractError } from "@/shared/validation/errors";
import {
  analysisResultSchemaEnvelope,
  baselineResultSchemaEnvelope,
} from "@/modules/analysis/domain/schemas";

const analysisResult = {
  readiness: 76,
  confidence: "medium" as const,
  metrics: {
    sleepRhythmStability: 60,
    phoneWindDown: 70,
    caffeineSignal: 80,
    sleepGoalAttainment: 75,
  },
  dataBasis: {
    periodStart: "2026-08-07",
    periodEnd: "2026-08-20",
    sampleCount: 14,
    excludedCount: 0,
    missingFields: [],
    completenessByCategory: {
      sleep: 1,
      phone: 1,
      meal: 1,
      exercise: 1,
      caffeine: 1,
      alcohol: 1,
      wellness: 1,
    },
    sourceDistribution: { manual: 1 },
    computedAt: "2026-08-20T00:00:00.000Z",
    algorithmVersion: "provisional-v1" as const,
    confidence: "medium" as const,
  },
  evidence: [],
  missingFields: ["regularity", "caffeine"] as const,
};

const JSON_LIMIT_BYTES = 65_536;
const VERSIONED_TEXT_PAYLOAD_OVERHEAD_BYTES = 29;

const serializedPayloadAtBytes = (byteLength: number): string => (
  `{"schemaVersion":1,"text":"${"x".repeat(byteLength - VERSIONED_TEXT_PAYLOAD_OVERHEAD_BYTES)}"}`
);

const objectPayloadAtSerializedBytes = (byteLength: number) => ({
  schemaVersion: 1,
  text: "x".repeat(byteLength - VERSIONED_TEXT_PAYLOAD_OVERHEAD_BYTES),
});

describe("versioned-json", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseVersionedJson("not json")).toThrow(JsonContractError);
    expect(() => parseVersionedJson("not json")).toThrow("INVALID_JSON_VALUE");
  });

  it("rejects unknown schema version", () => {
    expect(() => parseVersionedJson(JSON.stringify({ schemaVersion: 2, text: "x" }))).toThrow("UNKNOWN_SCHEMA_VERSION");
  });

  it("measures raw read payloads without JSON-stringifying them again", () => {
    const justBelow = serializedPayloadAtBytes(JSON_LIMIT_BYTES - 1);
    const exactlyAt = serializedPayloadAtBytes(JSON_LIMIT_BYTES);
    const above = serializedPayloadAtBytes(JSON_LIMIT_BYTES + 1);

    expect(Buffer.byteLength(justBelow, "utf8")).toBe(JSON_LIMIT_BYTES - 1);
    expect(Buffer.byteLength(exactlyAt, "utf8")).toBe(JSON_LIMIT_BYTES);
    expect(Buffer.byteLength(above, "utf8")).toBe(JSON_LIMIT_BYTES + 1);
    expect(parseVersionedJson(justBelow).schemaVersion).toBe(1);
    expect(parseVersionedJson(exactlyAt).schemaVersion).toBe(1);
    expect(() => parseVersionedJson(above)).toThrow("JSON_TOO_LARGE");
  });

  it("measures the serialized value on the write path at the 64 KiB boundary", () => {
    const justBelow = objectPayloadAtSerializedBytes(JSON_LIMIT_BYTES - 1);
    const exactlyAt = objectPayloadAtSerializedBytes(JSON_LIMIT_BYTES);
    const above = objectPayloadAtSerializedBytes(JSON_LIMIT_BYTES + 1);

    expect(Buffer.byteLength(JSON.stringify(justBelow), "utf8")).toBe(JSON_LIMIT_BYTES - 1);
    expect(Buffer.byteLength(JSON.stringify(exactlyAt), "utf8")).toBe(JSON_LIMIT_BYTES);
    expect(Buffer.byteLength(JSON.stringify(above), "utf8")).toBe(JSON_LIMIT_BYTES + 1);
    expect(() => assertJsonSize(justBelow)).not.toThrow();
    expect(() => assertJsonSize(exactlyAt)).not.toThrow();
    expect(() => assertJsonSize(above)).toThrow("JSON_TOO_LARGE");
  });

  it("parses a versioned payload", () => {
    expect(parseVersionedJson(JSON.stringify({ schemaVersion: 1, text: "ok" }))).toEqual({
      schemaVersion: 1,
      text: "ok",
    });
  });

  it("validates baseline and analysis envelopes with one schema version", () => {
    expect(baselineResultSchemaEnvelope.parse({
      schemaVersion: 1,
      baseline: {
        baselineSleepMinutes: 480,
        baselineBedMinuteOfDay: 1380,
        baselineWakeMinuteOfDay: 420,
        sampleCount: 7,
        excludedCount: 0,
        confidence: "medium",
      },
    }).baseline.sampleCount).toBe(7);

    expect(analysisResultSchemaEnvelope.parse({
      schemaVersion: 1,
      baselineSnapshotId: "baseline-1",
      analysisResult,
    }).baselineSnapshotId).toBe("baseline-1");
  });

  it("rejects readiness missing fields outside semantic order", () => {
    expect(() => analysisResultSchemaEnvelope.parse({
      schemaVersion: 1,
      baselineSnapshotId: "baseline-1",
      analysisResult: {
        ...analysisResult,
        missingFields: ["caffeine", "regularity"],
      },
    })).toThrow("missingFields must follow readiness field order");
  });
});
