import { describe, expect, it, vi } from "vitest";
import { createCompleteRoutineStepService } from "@/modules/care/application/complete-routine-step";
import { createUndoRoutineStepService } from "@/modules/care/application/undo-routine-step";
import { createStartCareToolService } from "@/modules/care/application/start-care-tool";
import { createCompleteCareToolService } from "@/modules/care/application/complete-care-tool";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };
const clock = { now: () => new Date("2026-08-19T13:30:00.000Z") };

describe("Care routine and tool sessions", () => {
  it("allows same-day completion/undo but rejects a closed local day", async () => {
    const repository = { findActivePlanDay: vi.fn().mockResolvedValue({ id: "plan-day-1" }), completeStep: vi.fn(), undoStep: vi.fn() };
    const complete = createCompleteRoutineStepService(scope, { clock, repository: repository as never });
    const undo = createUndoRoutineStepService(scope, { clock, repository: repository as never });

    await complete.complete({ localDate: "2026-08-19", planDayId: "plan-day-1", routineRevisionKey: "plan-day:plan-day-1", stepKey: "phone-wind-down", idempotencyKey: "complete-1" });
    await undo.undo({ localDate: "2026-08-19", planDayId: "plan-day-1", routineRevisionKey: "plan-day:plan-day-1", stepKey: "phone-wind-down", idempotencyKey: "undo-1" });
    await expect(undo.undo({ localDate: "2026-08-18", planDayId: "plan-day-1", routineRevisionKey: "plan-day:plan-day-1", stepKey: "phone-wind-down", idempotencyKey: "undo-closed" })).rejects.toThrow("ROUTINE_DAY_CLOSED");
    expect(repository.completeStep).toHaveBeenCalledOnce();
    expect(repository.undoStep).toHaveBeenCalledOnce();
  });

  it("rejects routine writes when the displayed plan day is absent or superseded", async () => {
    const repository = { findActivePlanDay: vi.fn().mockResolvedValue(null), findGoal: vi.fn().mockResolvedValue(null), completeStep: vi.fn(), undoStep: vi.fn() };
    const complete = createCompleteRoutineStepService(scope, { clock, repository: repository as never });

    await expect(complete.complete({ localDate: "2026-08-19", planDayId: "plan-day-stale", routineRevisionKey: "plan-day:plan-day-stale", stepKey: "phone-wind-down", idempotencyKey: "complete-missing-plan" })).rejects.toThrow("ROUTINE_PLAN_DAY_UNAVAILABLE");
    expect(repository.completeStep).not.toHaveBeenCalled();
  });

  it("persists and undoes a goal-derived routine without an accepted plan", async () => {
    const repository = {
      findActivePlanDay: vi.fn().mockResolvedValue(null),
      findGoal: vi.fn().mockResolvedValue({ targetBedTime: "22:30", targetWakeTime: "06:30", targetDurationMinutes: 480 }),
      completeStep: vi.fn(),
      undoStep: vi.fn(),
    };
    const complete = createCompleteRoutineStepService(scope, { clock, repository: repository as never });
    const undo = createUndoRoutineStepService(scope, { clock, repository: repository as never });
    const target = { localDate: "2026-08-19", planDayId: null, routineRevisionKey: "goal:22:30:06:30:480", stepKey: "phone-wind-down" as const };

    await complete.complete({ ...target, idempotencyKey: "goal-complete" });
    await undo.undo({ ...target, idempotencyKey: "goal-undo" });

    expect(repository.completeStep).toHaveBeenCalledWith("2026-08-19", "goal:22:30:06:30:480", null, "phone-wind-down", expect.any(Date));
    expect(repository.undoStep).toHaveBeenCalledWith("2026-08-19", "goal:22:30:06:30:480", null, "phone-wind-down");
  });

  it("caps tool sessions and lets repeated natural completion write once", async () => {
    const repository = { startTool: vi.fn().mockResolvedValue({ sessionId: "session-1" }), completeTool: vi.fn().mockResolvedValue(undefined) };
    const start = createStartCareToolService(scope, { clock, repository: repository as never });
    const complete = createCompleteCareToolService(scope, { clock, repository: repository as never });

    await start.start({ localDate: "2026-08-19", toolKey: "white-noise", plannedDurationSeconds: 9_999, idempotencyKey: "tool-start" });
    await complete.complete({ sessionId: "session-1", idempotencyKey: "tool-complete" });
    await complete.complete({ sessionId: "session-1", idempotencyKey: "tool-complete-repeat" });

    expect(repository.startTool).toHaveBeenCalledWith(expect.objectContaining({ plannedDurationSeconds: 900 }));
    expect(repository.completeTool).toHaveBeenCalledTimes(2);
  });
});
