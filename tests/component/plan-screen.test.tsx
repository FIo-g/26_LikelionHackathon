import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { CalendarConnectionCard } from "@/modules/planner/ui/calendar-connection-card";
import { PlanCalendar } from "@/modules/planner/ui/plan-calendar";
import { PlanDesktopContent, PlanMobileContent, PlanScreen } from "@/modules/planner/ui/plan-screen";
import type { PlanViewModel } from "@/modules/planner/application/get-plan-view-model";

const viewModel: PlanViewModel = {
  timezone: "America/New_York",
  calendarConnection: { availability: "coming-soon" },
  planStatus: "none",
  dismissedAdvice: false,
  events: [{ id: "event-1", title: "아침 비행", type: "travel", startsAt: "2026-08-22T00:00:00.000Z" }],
  advice: {
    id: "advice-1",
    timezone: "America/New_York",
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

    expect(screen.getByText("캘린더 연결")).toBeVisible();
    expect(screen.getByRole("button", { name: "연동 준비 중" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "직접 입력" })).toBeVisible();
  });

  it("places real events in the anchored month and keeps events outside that month visible", () => {
    render(<PlanCalendar
      anchorLocalDate="2026-08-21"
      todayLocalDate="2026-08-21"
      events={[
        { id: "august", title: "졸업 발표", type: "발표", startsAt: "2026-08-22T00:00:00.000Z" },
        { id: "september", title: "해외 출장", type: "출장", startsAt: "2026-09-02T14:00:00.000Z" },
      ]}
      timezone="America/New_York"
    />);

    expect(screen.getByRole("heading", { name: "2026년 8월" })).toBeVisible();
    expect(screen.getByText("졸업 발표")).toBeVisible();
    expect(screen.getByText("발표")).toBeVisible();
    expect(screen.getByRole("heading", { name: "다른 달 일정" })).toBeVisible();
    expect(screen.getByText("해외 출장")).toBeVisible();
    expect(screen.getByLabelText("일정 범례")).toHaveTextContent("직접 입력한 주요 일정");
  });

  it("navigates calendar months and marks the current day without changing saved event data", () => {
    const { container } = render(<PlanCalendar
      anchorLocalDate="2026-08-21"
      todayLocalDate="2026-08-21"
      events={[{ id: "september", title: "해외 출장", type: "출장", startsAt: "2026-09-02T14:00:00.000Z" }]}
      timezone="America/New_York"
    />);

    expect(container.querySelector('time[aria-current="date"]')).toHaveTextContent("21");
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(screen.getByRole("heading", { name: "2026년 9월" })).toBeVisible();
    expect(screen.getByText("해외 출장")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "이번 달" }));
    expect(screen.getByRole("heading", { name: "2026년 8월" })).toBeVisible();
  });

  it("renders direct event entry and generated advice controls", () => {
    render(<PlanDesktopContent viewModel={viewModel} />);

    expect(screen.getByRole("button", { name: "주요 일정 추가" })).toBeVisible();
    expect(screen.getByRole("button", { name: "계획에 반영" })).toBeVisible();
    expect(screen.getByRole("button", { name: "제안 닫기" })).toBeVisible();
    expect(screen.getByText("목표 수면 · 일정 시간 · 사용 가능한 기록")).toBeVisible();
    expect(screen.getByRole("region", { name: "앞으로 2주" })).toBeVisible();
  });

  it("formats plan instants in the ViewModel timezone", () => {
    render(<PlanScreen viewModel={viewModel} />);

    expect(screen.getByText("취침 10:00")).toBeVisible();
    expect(screen.getByText("기상 18:00")).toBeVisible();
  });

  it("keeps responsive major-event form landmarks uniquely addressable", () => {
    const { container } = render(<PlanScreen viewModel={viewModel} />);

    expect(container.querySelectorAll("#major-event-form")).toHaveLength(1);
    expect(container.querySelectorAll("#major-event-title")).toHaveLength(1);
    expect(container.querySelector("#mobile-major-event-form")).toHaveAccessibleName("주요 일정 추가");
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

  it("shows upcoming events instead of truncating the oldest events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      render(<PlanMobileContent viewModel={{
        ...viewModel,
        events: [
          { id: "past-1", title: "지난 일정 1", type: "여행", startsAt: "2026-08-18T12:00:00.000Z" },
          { id: "past-2", title: "지난 일정 2", type: "여행", startsAt: "2026-08-19T12:00:00.000Z" },
          { id: "past-3", title: "지난 일정 3", type: "여행", startsAt: "2026-08-20T12:00:00.000Z" },
          { id: "upcoming-1", title: "다가오는 일정", type: "여행", startsAt: "2026-08-22T12:00:00.000Z" },
          { id: "upcoming-2", title: "다가오는 일정 2", type: "여행", startsAt: "2026-08-23T12:00:00.000Z" },
          { id: "upcoming-3", title: "다가오는 일정 3", type: "여행", startsAt: "2026-08-24T12:00:00.000Z" },
          { id: "upcoming-4", title: "다가오는 일정 4", type: "여행", startsAt: "2026-08-25T12:00:00.000Z" },
        ],
      }} />);

      expect(screen.getByText("다가오는 일정")).toBeVisible();
      expect(screen.getByText("다가오는 일정 4")).toBeVisible();
      expect(screen.queryByText("지난 일정 1")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps past events out of the desktop upcoming calendar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      render(<PlanDesktopContent viewModel={{
        ...viewModel,
        events: [
          { id: "past", title: "지난 발표", type: "발표", startsAt: "2026-08-20T12:00:00.000Z" },
          { id: "future", title: "다가오는 발표", type: "발표", startsAt: "2026-08-22T12:00:00.000Z" },
        ],
      }} />);

      expect(screen.getByText("다가오는 발표")).toBeVisible();
      expect(screen.queryByText("지난 발표")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
