import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CareScreen } from "@/modules/care/ui/care-screen";

describe("CareScreen", () => {
  it("renders direct-input sync state, the derived routine, and exactly three tools", () => {
    render(<CareScreen viewModel={{
      localDate: "2026-08-19", timezone: "America/New_York", activePlanDayId: "plan-day-1", routineRevisionKey: "plan-day:plan-day-1", planDay: null, inputState: "complete",
      routineSteps: [{ key: "target-bed", label: "잠자리", scheduledAt: new Date("2026-08-19T14:00:00.000Z"), status: "current" }],
    }} />);

    expect(screen.getByRole("heading", { name: "오늘 밤 케어" })).toBeInTheDocument();
    expect(screen.getByText("직접 입력 사용 중")).toBeInTheDocument();
    expect(screen.getByText("호흡 가이드")).toBeInTheDocument();
    expect(screen.getByText("백색소음")).toBeInTheDocument();
    expect(screen.getByText("ASMR·수면 가이드")).toBeInTheDocument();
    expect(screen.getByTestId("routine-time")).toHaveAttribute("data-timezone", "America/New_York");
    expect(screen.getByText("현재", { selector: "span" })).toBeVisible();
  });

  it("keeps a goal-derived routine actionable without an accepted plan", () => {
    render(<CareScreen viewModel={{
      localDate: "2026-08-19", timezone: "America/New_York", activePlanDayId: null, routineRevisionKey: "goal:22:30:06:30:480", planDay: null, inputState: "complete",
      routineSteps: [{ key: "target-bed", label: "잠자리", scheduledAt: new Date("2026-08-19T14:00:00.000Z"), status: "current" }],
    }} />);

    expect(screen.getByRole("button", { name: "완료" })).toBeEnabled();
  });
});
