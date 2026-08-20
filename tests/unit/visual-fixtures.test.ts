import { describe, expect, it, vi } from "vitest";
import { visualIdentity, visualSnapshotEmail } from "../visual/fixtures";
import { visualAnalysisResult, visualNarrationOutput } from "../../scripts/seed-visual-fixtures";
import { analysisResultSchemaEnvelope } from "@/modules/analysis/domain/schemas";
import { narrationOutputSchema } from "@/modules/narration/domain/narration-schema";
import { authenticateVisualUser } from "../visual/authenticate";

describe("visualIdentity", () => {
  it("keeps fixture users isolated while masking their visible address consistently", () => {
    expect(visualSnapshotEmail()).toBe("visual-account@example.invalid");
    expect(visualIdentity(3, "account-desktop").email).not.toBe(visualIdentity(2, "account-desktop").email);
  });

  it("authenticates through the isolated setup route so HTTP cleanup owns the same identity", async () => {
    const identity = visualIdentity(4, "today-mobile");
    const post = vi.fn().mockResolvedValue({ ok: () => true });

    await authenticateVisualUser({ request: { post } } as never, identity);

    expect(post).toHaveBeenCalledWith("/__e2e/setup", {
      data: { workerIndex: identity.workerIndex, namespace: identity.namespace },
    });
  });
});

describe("complete visual analysis fixture", () => {
  it("uses schema-valid ready analysis and safe template narration output", () => {
    expect(analysisResultSchemaEnvelope.parse({ schemaVersion: 1, baselineSnapshotId: "visual-baseline-snapshot", analysisResult: visualAnalysisResult }).analysisResult.readiness).toBe(78);
    expect(narrationOutputSchema.parse(visualNarrationOutput)).toMatchObject({ headline: expect.any(String), bullets: expect.any(Array) });
  });
});
