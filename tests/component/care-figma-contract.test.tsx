import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  completeRoutineStep: vi.fn(),
  undoRoutineStep: vi.fn(),
  startCareTool: vi.fn(),
  completeCareTool: vi.fn(),
}));

vi.mock("@/app/(app)/care/actions", () => ({
  completeRoutineStepAction: actions.completeRoutineStep,
  undoRoutineStepAction: actions.undoRoutineStep,
  startCareToolAction: actions.startCareTool,
  completeCareToolAction: actions.completeCareTool,
}));

import { CareScreen } from "@/modules/care/ui/care-screen";

beforeEach(() => {
  actions.completeRoutineStep.mockReset().mockResolvedValue({ ok: true });
  actions.undoRoutineStep.mockReset().mockResolvedValue({ ok: true });
  actions.startCareTool.mockReset().mockResolvedValue({ ok: true, sessionId: "care-session" });
  actions.completeCareTool.mockReset().mockResolvedValue({ ok: true });
});

describe("Care Figma integration contract", () => {
  it("keeps the Care screen identity and real routine mutation reachable", async () => {
    const { container } = render(<CareScreen viewModel={{
      localDate: "2026-08-19",
      timezone: "Asia/Seoul",
      activePlanDayId: "plan-day-1",
      routineRevisionKey: "plan-day:plan-day-1",
      planDay: null,
      inputState: "complete",
      routineSteps: [{
        key: "target-bed",
        label: "잠자리",
        scheduledAt: new Date("2026-08-19T14:00:00.000Z"),
        status: "current",
      }],
    }} />);

    const careScreen = container.querySelector('main[data-lunar-screen="care"]');
    expect(careScreen).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "완료" }));

    await waitFor(() => expect(actions.completeRoutineStep).toHaveBeenCalledWith({
      localDate: "2026-08-19",
      planDayId: "plan-day-1",
      routineRevisionKey: "plan-day:plan-day-1",
      stepKey: "target-bed",
    }));
  });

  it("keeps breathing and white-noise controls available inside the Care screen", () => {
    const { container } = render(<CareScreen viewModel={{
      localDate: "2026-08-19",
      timezone: "Asia/Seoul",
      activePlanDayId: null,
      routineRevisionKey: "goal:22:30:06:30:480",
      planDay: null,
      inputState: "complete",
      routineSteps: [],
    }} />);

    const careScreen = container.querySelector('main[data-lunar-screen="care"]');
    expect(careScreen).toBeInTheDocument();
    for (const label of ["호흡 가이드", "백색소음"]) {
      expect(screen.getByRole("progressbar", { name: `${label} 진행` })).toBeVisible();
    }
    expect(screen.getAllByRole("button", { name: "시작" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("button", { name: "멈추기" }).length).toBeGreaterThanOrEqual(2);
  });
});
