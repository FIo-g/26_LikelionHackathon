import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisReport } from "@/modules/analysis/ui/analysis-report";

describe("AnalysisReport narration retry", () => {
  it("exposes an accessible retry control only for fallback narration below its retry limit", () => {
    render(<AnalysisReport report={{ status: "template-fallback", headline: "대체 리포트", body: "본문", bullets: [] }} narration={{ id: "narration-1", retryAvailable: true }} />);

    const retryButton = screen.getByRole("button", { name: "리포트 다시 시도" });

    expect(retryButton).toBeInTheDocument();
    expect(retryButton.className).toContain("retryButton");
  });

  it("offers a styled initial AI attempt only for an available calculated report", () => {
    const { rerender } = render(
      <AnalysisReport
        attemptAvailable
        narration={null}
        report={{ status: "template-fallback", headline: "기본 리포트", body: "본문", bullets: [] }}
      />,
    );

    const attemptButton = screen.getByRole("button", { name: "AI 리포트 시도" });
    expect(attemptButton.className).toContain("retryButton");

    rerender(
      <AnalysisReport
        attemptAvailable
        narration={null}
        report={{ status: "pending", headline: "분석 준비 중", body: "본문", bullets: [] }}
      />,
    );

    expect(screen.queryByRole("button", { name: "AI 리포트 시도" })).not.toBeInTheDocument();
  });
});
