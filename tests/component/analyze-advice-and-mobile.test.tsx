import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { AnalyzeScreen } from "@/modules/analysis/ui/analysis-report";
import type { AnalyzeViewModel } from "@/modules/analysis/application/get-analyze-view-model";
import { ScheduleAdviceCard } from "@/modules/planner/ui/schedule-advice-card";
import { MetricGrid } from "@/modules/analysis/ui/metric-grid";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

type ScheduleAdviceCardProps = ComponentProps<typeof ScheduleAdviceCard>;
type ScheduleAdviceCardTimezone = Pick<ScheduleAdviceCardProps, "timezone">;
const scheduleAdviceCardRequiresTimezone: ScheduleAdviceCardTimezone extends Required<ScheduleAdviceCardTimezone> ? true : false = true;

const viewModel = {
  state: "ready",
  metrics: [
    { key: "sleep-rhythm", label: "수면 리듬", value: 72, state: "ready" },
    { key: "phone-wind-down", label: "폰 정리", value: 48, state: "ready" },
    { key: "caffeine-signal", label: "카페인", value: 36, state: "ready" },
    { key: "sleep-goal", label: "수면 목표", value: 64, state: "ready" },
  ],
  trend: [],
  caffeineProfile: { signal: 50, wording: "관찰된 신호", whatIfEnabled: false },
  explainability: [],
  dataBasis: {
    periodStart: "2026-08-06",
    periodEnd: "2026-08-19",
    sampleCount: 10,
    excludedCount: 0,
    missingFields: [],
    completenessByCategory: {},
    sourceDistribution: {},
    computedAt: "2026-08-20T00:00:00.000Z",
    algorithmVersion: "provisional-v1",
    confidence: "low",
  },
  report: { status: "template-fallback", headline: "최근 수면 패턴", body: "본문", bullets: [] },
  scheduleAdvice: {
    id: "reroute-advice",
    timezone: "America/New_York",
    triggerType: "reroute",
    status: "generated",
    headline: "카페인 기록에 맞춰 수면 시간을 조정해요",
    proposal: {
      adjustmentStartsOn: "2026-08-22",
      eventWakeAt: "2026-08-22T23:15:00.000Z",
      days: [{
        localDate: "2026-08-22",
        targetBedAt: "2026-08-22T15:15:00.000Z",
        targetWakeAt: "2026-08-22T23:15:00.000Z",
        caffeineCutoffAt: "2026-08-22T08:15:00.000Z",
        exerciseCutoffAt: "2026-08-22T11:15:00.000Z",
        mealCutoffAt: "2026-08-22T12:15:00.000Z",
        windDownAt: "2026-08-22T14:15:00.000Z",
      }],
      conflicts: [],
      confidence: "low",
      evidence: [],
      algorithmVersion: "provisional-v1",
    },
    diff: [],
  },
} as unknown as AnalyzeViewModel;

describe("AnalyzeScreen advice and mobile details", () => {
  it("renders reroute advice through the established confirmation dialog and retains the mobile disclosure", () => {
    render(<AnalyzeScreen viewModel={viewModel} />);

    expect(scheduleAdviceCardRequiresTimezone).toBe(true);
    expect(screen.getByText("기록된 활동에 맞춰 이후 계획을 조정해요")).toBeInTheDocument();
    expect(screen.getByText(/2026\. 8\. 22\. 19:15/)).toBeInTheDocument();
    expect(screen.getByText("전체 지표·근거 보기")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "계획에 반영" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the mobile metric label available to assistive technology", () => {
    render(<MetricGrid metrics={[{
      key: "sleep-goal",
      label: "수면 목표",
      value: 80,
      state: "ready",
    }]} />);

    expect(screen.getByText("목표 수면")).not.toHaveAttribute("aria-hidden", "true");
  });

  it("keeps every metric in the expanded mobile detail grid", () => {
    const { container } = render(<AnalyzeScreen viewModel={viewModel} />);
    const summaryHeading = container.querySelector("#analysis-summary-metrics-title");
    const detailsHeading = container.querySelector("#analysis-details-metrics-title");
    const detailsSection = detailsHeading?.closest("section");

    expect(summaryHeading).toBeInTheDocument();
    expect(detailsHeading).toBeInTheDocument();
    expect(detailsSection?.className).not.toContain("mobileSummaryMetrics");
    expect(detailsSection?.querySelectorAll("[data-metric-key]")).toHaveLength(4);
    expect(detailsSection?.querySelector('[data-metric-key="sleep-rhythm"]')).toHaveTextContent("수면 리듬");
    expect(detailsSection?.querySelector('[data-metric-key="phone-wind-down"]')).toHaveTextContent("폰 정리");
  });
});
