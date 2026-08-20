import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { CalendarConnectionCard } from "@/modules/planner/ui/calendar-connection-card";
import { PlanMobileContent, PlanScreen } from "@/modules/planner/ui/plan-screen";
import type { PlanViewModel } from "@/modules/planner/application/get-plan-view-model";

const viewModel: PlanViewModel = {
  timezone: "America/New_York",
  calendarConnection: { availability: "coming-soon" },
  planStatus: "none",
  dismissedAdvice: false,
  events: [{ id: "event-1", type: "travel", startsAt: "2026-08-22T00:00:00.000Z" }],
  advice: {
    id: "advice-1",
    triggerType: "event",
    status: "generated",
    headline: "아침 비행에 맞춰 기상 시간을 조정해요",
    proposal: {
      adjustmentStartsOn: "2026-08-21",
      eventWakeAt: "2026-08-21T19:00:00.000Z",
      days: [{
        localDate: "2026-08-21",
        targetBedAt: "2026-08-21T14:00:00.000Z",
        targetWakeAt: "2026-08-21T22:00:00.000Z",
        caffeineCutoffAt: "2026-08-21T06:00:00.000Z",
        exerciseCutoffAt: "2026-08-21T11:00:00.000Z",
        mealCutoffAt: "2026-08-21T12:00:00.000Z",
        windDownAt: "2026-08-21T13:00:00.000Z",
      }],
      conflicts: [],
      confidence: "low",
      evidence: [],
      algorithmVersion: "provisional-v1",
    },
    diff: [{
      localDate: "2026-08-21",
      before: null,
      after: {
        localDate: "2026-08-21",
        targetBedAt: "2026-08-21T14:00:00.000Z",
        targetWakeAt: "2026-08-21T22:00:00.000Z",
        caffeineCutoffAt: "2026-08-21T06:00:00.000Z",
        exerciseCutoffAt: "2026-08-21T11:00:00.000Z",
        mealCutoffAt: "2026-08-21T12:00:00.000Z",
        windDownAt: "2026-08-21T13:00:00.000Z",
      },
    }],
  },
  days: [{
    localDate: "2026-08-21",
    targetBedAt: "2026-08-21T14:00:00.000Z",
    targetWakeAt: "2026-08-21T22:00:00.000Z",
    caffeineCutoffAt: "2026-08-21T06:00:00.000Z",
    exerciseCutoffAt: "2026-08-21T11:00:00.000Z",
    mealCutoffAt: "2026-08-21T12:00:00.000Z",
    windDownAt: "2026-08-21T13:00:00.000Z",
  }],
};

describe("Plan screen", () => {
  it("keeps calendar connection unavailable and sends people to direct entry", () => {
    render(<CalendarConnectionCard availability="coming-soon" />);

    expect(screen.getByText("캘린더 연동 준비 중")).toBeVisible();
    expect(screen.getByRole("link", { name: "주요 일정 직접 입력" })).toBeVisible();
  });

  it("renders direct event entry and generated advice controls", () => {
    render(<PlanScreen viewModel={viewModel} />);

    expect(screen.getByRole("button", { name: "주요 일정 추가" })).toBeVisible();
    expect(screen.getByRole("button", { name: "계획에 반영" })).toBeVisible();
    expect(screen.getByRole("button", { name: "제안 닫기" })).toBeVisible();
    expect(screen.getByRole("region", { name: "앞으로 2주" })).toBeVisible();
  });

  it("formats plan instants in the ViewModel timezone", () => {
    render(<PlanScreen viewModel={viewModel} />);

    expect(screen.getByText("취침 10:00")).toBeVisible();
    expect(screen.getByText("기상 18:00")).toBeVisible();
  });

  it("uses nearby advice instead of desktop calendar and strip in the mobile presentation", () => {
    render(<PlanMobileContent viewModel={viewModel} />);

    expect(screen.getByRole("region", { name: "가까운 수면 일정" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "일정 캘린더" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "앞으로 2주" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "주요 일정 추가" })).toBeVisible();
    expect(screen.getByRole("button", { name: "계획에 반영" })).toBeVisible();
    expect(screen.getByRole("button", { name: "제안 닫기" })).toBeVisible();
  });
});
