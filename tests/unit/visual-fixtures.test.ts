import { describe, expect, it } from "vitest";
import { visualIdentity, visualSnapshotEmail } from "../visual/fixtures";
import { visualAnalysisResult, visualNarrationOutput } from "../../scripts/seed-visual-fixtures";
import { analysisResultSchemaEnvelope } from "@/modules/analysis/domain/schemas";
import { narrationOutputSchema } from "@/modules/narration/domain/narration-schema";

describe("visualIdentity", () => {
  it("keeps fixture users isolated while masking their visible address consistently", () => {
    expect(visualSnapshotEmail()).toBe("visual-account@example.invalid");
    expect(visualIdentity(3, "account-desktop").email).not.toBe(visualIdentity(2, "account-desktop").email);
  });
});

describe("complete visual analysis fixture", () => {
  it("uses schema-valid ready analysis and safe template narration output", () => {
    expect(analysisResultSchemaEnvelope.parse({ schemaVersion: 1, analysisResult: visualAnalysisResult }).analysisResult.readiness).toBe(78);
    expect(narrationOutputSchema.parse(visualNarrationOutput)).toMatchObject({ headline: expect.any(String), bullets: expect.any(Array) });
  });
});
