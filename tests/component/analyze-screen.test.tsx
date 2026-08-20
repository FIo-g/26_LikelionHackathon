import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { AnalysisReport, AnalyzeScreen } from "@/modules/analysis/ui/analysis-report";
import type { AnalyzeViewModel } from "@/modules/analysis/application/get-analyze-view-model";
import { CaffeineProfile } from "@/modules/analysis/ui/caffeine-profile";
import { DataBasisPanel } from "@/modules/analysis/ui/data-basis-panel";
import { MetricGrid } from "@/modules/analysis/ui/metric-grid";
import { SleepTrendChart } from "@/modules/analysis/ui/sleep-trend-chart";

const dataBasis = {
  periodStart: "2026-08-06", periodEnd: "2026-08-19", sampleCount: 10, excludedCount: 1, missingFields: [],
  completenessByCategory: { sleep: 1, phone: 1, meal: 1, exercise: 1, caffeine: 1, alcohol: 1, wellness: 1 },
  sourceDistribution: { manual: 10 }, computedAt: "2026-08-19T09:00:00.000Z", algorithmVersion: "provisional-v1" as const, confidence: "medium" as const,
};

const screenViewModel: AnalyzeViewModel = {
  state: "ready",
  metrics: [
    { key: "sleep-rhythm", label: "수면 리듬", value: 72, state: "ready" },
    { key: "phone-wind-down", label: "폰 정리", value: 48, state: "ready" },
    { key: "caffeine-signal", label: "카페인", value: 36, state: "ready" },
    { key: "sleep-goal", label: "수면 목표", value: 64, state: "ready" },
  ],
  trend: [],
  caffeineProfile: { signal: null, wording: "관찰된 신호", whatIfEnabled: false },
  explainability: [],
  dataBasis,
  report: { status: "template-fallback", headline: "최근 수면 패턴", body: "저장된 기록을 기준으로 정리했습니다.", bullets: [] },
  narration: null,
  scheduleAdvice: null,
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
    expect(screen.getByText("분석 리포트")).toBeVisible();
    expect(screen.queryByText("AI 분석 리포트")).not.toBeInTheDocument();
  });

  it("uses the AI report label only for a generated narration", () => {
    render(<AnalysisReport report={{ status: "ready", headline: "최근 수면 패턴", body: "저장된 기록을 기준으로 정리했습니다.", bullets: [] }} />);

    expect(screen.getByText("AI 분석 리포트")).toBeVisible();
    expect(screen.getByText("AI 서술")).toBeVisible();
  });

  it("adds a non-causal status tag and note to metrics", () => {
    render(<MetricGrid metrics={[{ key: "sleep-goal", label: "수면 목표", value: 72, state: "ready" }]} />);

    expect(screen.getByText("관찰")).toBeVisible();
    expect(screen.getByText("변화 추이를 계속 살펴봐요.")).toBeVisible();
    expect(screen.queryByText(/원인/)).not.toBeInTheDocument();
  });

  it("renders actual sleep records as bars with one shared goal line and an accessible detail table", () => {
    const { container } = render(<SleepTrendChart trend={[
      { localDate: "2026-08-18", sleepMinutes: 420, goalMinutes: 480 },
      { localDate: "2026-08-19", sleepMinutes: 450, goalMinutes: 480 },
      { localDate: "2026-08-20", sleepMinutes: null, goalMinutes: 480 },
    ]} />);

    expect(container.querySelectorAll('[data-trend-bar="true"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-goal-line="true"]')).toHaveLength(1);
    expect(screen.getByRole("img", { name: "최근 2주 수면 시간과 목표" })).toBeVisible();
    expect(container.querySelector("table")).toHaveTextContent("2026-08-19");
  });

  it("scrolls and focuses the real data basis panel from the Analyze control", () => {
    render(<AnalyzeScreen viewModel={screenViewModel} />);

    const target = document.getElementById("analysis-data-basis");
    if (!target) throw new Error("Expected the analysis data basis panel");
    expect(document.querySelectorAll("#analysis-data-basis")).toHaveLength(1);
    expect(document.getElementById("analysis-data-basis-details")).toBeInTheDocument();
    const scrollIntoView = vi.fn();
    Object.defineProperty(target, "scrollIntoView", { configurable: true, value: scrollIntoView });

    fireEvent.click(screen.getByRole("button", { name: "분석 기준 보기" }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(target).toHaveFocus();
    expect(target).toHaveAttribute("tabindex", "-1");
  });
});
