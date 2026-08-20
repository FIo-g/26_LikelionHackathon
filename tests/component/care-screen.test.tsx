import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CareScreen } from "@/modules/care/ui/care-screen";

describe("CareScreen", () => {
  it("renders direct-input sync state, the derived routine, and four distinct tools", () => {
    render(<CareScreen viewModel={{
      localDate: "2026-08-19", timezone: "America/New_York", activePlanDayId: "plan-day-1", routineRevisionKey: "plan-day:plan-day-1", planDay: null, inputState: "complete",
      routineSteps: [{ key: "target-bed", label: "잠자리", scheduledAt: new Date("2026-08-19T14:00:00.000Z"), status: "current" }],
      rerouteAdvice: null, phonePattern: null, tomorrowPlan: null,
    }} />);

    expect(screen.getByRole("heading", { name: "오늘 밤 케어" })).toBeInTheDocument();
    expect(screen.getByText("직접 입력 사용 중")).toBeInTheDocument();
    expect(screen.getByText("호흡 가이드")).toBeInTheDocument();
    expect(screen.getByText("백색소음")).toBeInTheDocument();
    expect(screen.getByText("ASMR")).toBeInTheDocument();
    expect(screen.getByText("5분 이완")).toBeInTheDocument();
    expect(screen.getByLabelText("ASMR 음원 준비 중")).toHaveTextContent("지원 음원을 준비하고 있어요.");
    expect(screen.queryByRole("button", { name: "ASMR 시작" })).not.toBeInTheDocument();
    expect(screen.getByTestId("routine-time")).toHaveAttribute("data-timezone", "America/New_York");
    expect(screen.getByText("현재", { selector: "span" })).toBeVisible();
  });

  it("keeps a goal-derived routine actionable without an accepted plan", () => {
    render(<CareScreen viewModel={{
      localDate: "2026-08-19", timezone: "America/New_York", activePlanDayId: null, routineRevisionKey: "goal:22:30:06:30:480", planDay: null, inputState: "complete",
      routineSteps: [{ key: "target-bed", label: "잠자리", scheduledAt: new Date("2026-08-19T14:00:00.000Z"), status: "current" }],
      rerouteAdvice: null, phonePattern: null, tomorrowPlan: null,
    }} />);

    expect(screen.getByRole("button", { name: "완료" })).toBeEnabled();
  });

  it("renders optional Care signal cards only when persisted data supports them", () => {
    render(<CareScreen viewModel={{
      localDate: "2026-08-19", timezone: "Asia/Seoul", activePlanDayId: "plan-day-1", routineRevisionKey: "plan-day:plan-day-1", inputState: "complete", routineSteps: [],
      planDay: null,
      rerouteAdvice: { id: "reroute-1" },
      phonePattern: { sampleCount: 3, averageDurationMinutes: 42 },
      tomorrowPlan: {
        localDate: "2026-08-20", targetBedAt: "2026-08-20T14:30:00.000Z", targetWakeAt: "2026-08-20T22:30:00.000Z",
        caffeineCutoffAt: "2026-08-20T08:30:00.000Z", exerciseCutoffAt: "2026-08-20T11:30:00.000Z", mealCutoffAt: "2026-08-20T12:30:00.000Z", windDownAt: "2026-08-20T14:00:00.000Z",
      },
    }} />);

    expect(screen.getByRole("region", { name: "계획 조정 제안" })).toHaveTextContent("새 조정 제안이 있어요");
    expect(screen.getByRole("region", { name: "휴대폰 패턴" })).toHaveTextContent("최근 3일 평균 42분");
    expect(screen.getByRole("region", { name: "다음 수면 계획" })).toHaveTextContent("저장된 계획 기준이에요.");
    expect(screen.queryByText("수면 실험")).not.toBeInTheDocument();
  });
});
