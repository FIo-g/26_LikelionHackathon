import { describe, expect, it } from "vitest";
import { buildNarrationInput } from "@/modules/narration/domain/types";

describe("buildNarrationInput", () => {
  it("excludes identity, title, notes, and raw records from provider input", () => {
    const input = buildNarrationInput({
      target: { kind: "advice", id: "advice-1" }, algorithmVersion: "provisional-v1",
      metrics: [{ id: "readiness", value: 72, band: "보통" }],
      dataBasis: { periodStart: "2026-08-06", periodEnd: "2026-08-19", sampleCount: 10, excludedCount: 1, missingFields: [], sourceDistribution: { manual: 10 } },
      evidence: [], event: { type: "interview", startsAt: "2026-08-20T01:00:00.000Z" }, proposal: null, confidence: "medium",
      email: "user@example.com", title: "면접 회사 이름", notes: "개인 메모", rawRecords: [{ token: "session-token" }],
    } as never);

    const serialized = JSON.stringify(input);
    expect(serialized).not.toContain("user@example.com");
    expect(serialized).not.toContain("면접 회사 이름");
    expect(serialized).not.toContain("개인 메모");
    expect(serialized).not.toContain("session-token");
  });
});
