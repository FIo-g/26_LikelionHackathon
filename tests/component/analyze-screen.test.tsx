import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AnalysisReport } from "@/modules/analysis/ui/analysis-report";
import { CaffeineProfile } from "@/modules/analysis/ui/caffeine-profile";
import { DataBasisPanel } from "@/modules/analysis/ui/data-basis-panel";

const dataBasis = {
  periodStart: "2026-08-06", periodEnd: "2026-08-19", sampleCount: 10, excludedCount: 1, missingFields: [],
  completenessByCategory: { sleep: 1, phone: 1, meal: 1, exercise: 1, caffeine: 1, alcohol: 1, wellness: 1 },
  sourceDistribution: { manual: 10 }, computedAt: "2026-08-19T09:00:00.000Z", algorithmVersion: "provisional-v1" as const, confidence: "medium" as const,
};

describe("Analyze screen components", () => {
  it("renders the stored data basis rather than inferred copy", () => {
    render(<DataBasisPanel dataBasis={dataBasis} />);
    expect(screen.getByText("2026-08-06–2026-08-19")).toBeVisible();
    expect(screen.getByText("표본 10일")).toBeVisible();
    expect(screen.getByText("provisional-v1")).toBeVisible();
  });

  it("labels caffeine as an observed signal without causal wording", () => {
    render(<CaffeineProfile model={{ signal: 55, wording: "관찰된 신호", whatIfEnabled: true }} />);
    expect(screen.getByText(/관찰된 신호/)).toBeVisible();
    expect(screen.queryByText(/원인/)).not.toBeInTheDocument();
  });

  it("keeps template reports visibly provisional", () => {
    render(<AnalysisReport report={{ status: "template-fallback", headline: "최근 수면 패턴", body: "저장된 기록을 기준으로 정리했습니다.", bullets: [] }} />);
    expect(screen.getByText("초기 추정 모델이며 의료 진단이 아닙니다.")).toBeVisible();
  });
});
