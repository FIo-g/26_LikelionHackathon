import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisReport } from "@/modules/analysis/ui/analysis-report";

describe("AnalysisReport narration retry", () => {
  it("exposes an accessible retry control only for fallback narration below its retry limit", () => {
    render(<AnalysisReport report={{ status: "template-fallback", headline: "대체 리포트", body: "본문", bullets: [] }} narration={{ id: "narration-1", retryAvailable: true }} />);

    expect(screen.getByRole("button", { name: "리포트 다시 시도" })).toBeInTheDocument();
  });
});
