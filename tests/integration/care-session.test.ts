import { describe, expect, it, vi } from "vitest";
import { createCompleteRoutineStepService } from "@/modules/care/application/complete-routine-step";
import { createUndoRoutineStepService } from "@/modules/care/application/undo-routine-step";
import { createStartCareToolService } from "@/modules/care/application/start-care-tool";
import { createCompleteCareToolService } from "@/modules/care/application/complete-care-tool";
import { getCareViewModel } from "@/modules/care/application/get-care-view-model";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };
const clock = { now: () => new Date("2026-08-19T13:30:00.000Z") };
const tonightPlanDay = { id: "plan-day-1", localDate: "2026-08-20", targetWakeAt: "2026-08-19T22:00:00.000Z" };
const findTonightPlanDay = vi.fn().mockImplementation(async (query: { localDate: string }) => query.localDate === "2026-08-20" ? tonightPlanDay : null);

describe("Care routine and tool sessions", () => {
  it("selects the wake-date PlanDay for tonight with the owned timezone query", async () => {
    const planDay = {
      id: "plan-day-2", localDate: "2026-08-21",
      targetBedAt: "2026-08-20T14:00:00.000Z", targetWakeAt: "2026-08-20T22:00:00.000Z",
      caffeineCutoffAt: "2026-08-20T05:00:00.000Z", exerciseCutoffAt: "2026-08-20T10:00:00.000Z",
      mealCutoffAt: "2026-08-20T11:00:00.000Z", windDownAt: "2026-08-20T13:00:00.000Z",
    };
    const repository = {
      findActivePlanDay: vi.fn().mockImplementation(async (query: { localDate: string }) => query.localDate === "2026-08-21" ? planDay : null),
      findGoal: vi.fn().mockResolvedValue(null), listCompletions: vi.fn().mockResolvedValue(new Set()),
    };

    const result = await getCareViewModel(scope, { repository: repository as never, clock: { now: () => new Date("2026-08-20T12:00:00.000Z") } });

    expect(result.planDay?.localDate).toBe("2026-08-21");
    expect(repository.findActivePlanDay).toHaveBeenCalledWith({ userId: "user-1", localDate: "2026-08-21", timezone: "Asia/Seoul" });
  });

  it("only exposes optional Care cards from persisted reroute, phone, and next-plan data", async () => {
    const activePlan = {
      id: "plan-day-1", localDate: "2026-08-21",
      targetBedAt: "2026-08-20T14:00:00.000Z", targetWakeAt: "2026-08-20T22:00:00.000Z",
      caffeineCutoffAt: "2026-08-20T05:00:00.000Z", exerciseCutoffAt: "2026-08-20T10:00:00.000Z",
      mealCutoffAt: "2026-08-20T11:00:00.000Z", windDownAt: "2026-08-20T13:00:00.000Z",
    };
    const tomorrowPlan = { ...activePlan, id: "plan-day-2", localDate: "2026-08-22" };
    const repository = {
      findActivePlanDay: vi.fn().mockImplementation(async (query: { localDate: string }) => (
        query.localDate === "2026-08-21" ? activePlan : query.localDate === "2026-08-22" ? tomorrowPlan : null
      )),
      findGoal: vi.fn().mockResolvedValue(null),
      listCompletions: vi.fn().mockResolvedValue(new Set()),
      findGeneratedRerouteAdvice: vi.fn().mockResolvedValue({ id: "reroute-1" }),
      listRecentPhoneUsage: vi.fn().mockResolvedValue([
        { localDate: "2026-08-19", durationMinutes: 40 },
        { localDate: "2026-08-18", durationMinutes: 50 },
        { localDate: "2026-08-17", durationMinutes: 30 },
      ]),
    };

    const result = await getCareViewModel(scope, { repository: repository as never, clock: { now: () => new Date("2026-08-20T12:00:00.000Z") } });

    expect(result.rerouteAdvice).toEqual({ id: "reroute-1" });
    expect(result.phonePattern).toEqual({ sampleCount: 3, averageDurationMinutes: 40 });
    expect(result.tomorrowPlan?.localDate).toBe("2026-08-22");
  });

  it("does not create Care signal claims from incomplete or missing data", async () => {
    const repository = {
      findActivePlanDay: vi.fn().mockResolvedValue(null),
      findGoal: vi.fn().mockResolvedValue(null),
      listCompletions: vi.fn().mockResolvedValue(new Set()),
      findGeneratedRerouteAdvice: vi.fn().mockResolvedValue(null),
      listRecentPhoneUsage: vi.fn().mockResolvedValue([{ localDate: "2026-08-19", durationMinutes: 45 }]),
    };

    const result = await getCareViewModel(scope, { repository: repository as never, clock: { now: () => new Date("2026-08-20T12:00:00.000Z") } });

    expect(result.rerouteAdvice).toBeNull();
    expect(result.phonePattern).toBeNull();
    expect(result.tomorrowPlan).toBeNull();
  });

  it("allows same-day completion/undo but rejects a closed local day", async () => {
    const repository = { findActivePlanDay: findTonightPlanDay, completeStep: vi.fn(), undoStep: vi.fn() };
    const complete = createCompleteRoutineStepService(scope, { clock, repository: repository as never });
    const undo = createUndoRoutineStepService(scope, { clock, repository: repository as never });

    await complete.complete({ localDate: "2026-08-20", planDayId: "plan-day-1", routineRevisionKey: "plan-day:plan-day-1", stepKey: "phone-wind-down", idempotencyKey: "complete-1" });
    await undo.undo({ localDate: "2026-08-20", planDayId: "plan-day-1", routineRevisionKey: "plan-day:plan-day-1", stepKey: "phone-wind-down", idempotencyKey: "undo-1" });
    await expect(undo.undo({ localDate: "2026-08-18", planDayId: "plan-day-1", routineRevisionKey: "plan-day:plan-day-1", stepKey: "phone-wind-down", idempotencyKey: "undo-closed" })).rejects.toThrow("ROUTINE_DAY_CLOSED");
    expect(repository.completeStep).toHaveBeenCalledOnce();
    expect(repository.undoStep).toHaveBeenCalledOnce();
  });

  it("rejects routine writes when the displayed plan day is absent or superseded", async () => {
    const repository = { findActivePlanDay: vi.fn().mockResolvedValue(null), findGoal: vi.fn().mockResolvedValue(null), completeStep: vi.fn(), undoStep: vi.fn() };
    const complete = createCompleteRoutineStepService(scope, { clock, repository: repository as never });

    await expect(complete.complete({ localDate: "2026-08-20", planDayId: "plan-day-stale", routineRevisionKey: "plan-day:plan-day-stale", stepKey: "phone-wind-down", idempotencyKey: "complete-missing-plan" })).rejects.toThrow("ROUTINE_PLAN_DAY_UNAVAILABLE");
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
    const target = { localDate: "2026-08-20", planDayId: null, routineRevisionKey: "goal:22:30:06:30:480", stepKey: "phone-wind-down" as const };

    await complete.complete({ ...target, idempotencyKey: "goal-complete" });
    await undo.undo({ ...target, idempotencyKey: "goal-undo" });

    expect(repository.completeStep).toHaveBeenCalledWith("2026-08-20", "goal:22:30:06:30:480", null, "phone-wind-down", expect.any(Date));
    expect(repository.undoStep).toHaveBeenCalledWith("2026-08-20", "goal:22:30:06:30:480", null, "phone-wind-down");
  });

  it("caps tool sessions and lets repeated natural completion write once", async () => {
    const repository = { findActivePlanDay: findTonightPlanDay, startTool: vi.fn().mockResolvedValue({ sessionId: "session-1" }), completeTool: vi.fn().mockResolvedValue(undefined) };
    const start = createStartCareToolService(scope, { clock, repository: repository as never });
    const complete = createCompleteCareToolService(scope, { clock, repository: repository as never });

    await start.start({ localDate: "2026-08-20", toolKey: "white-noise", plannedDurationSeconds: 9_999, idempotencyKey: "tool-start" });
    await complete.complete({ sessionId: "session-1", idempotencyKey: "tool-complete" });
    await complete.complete({ sessionId: "session-1", idempotencyKey: "tool-complete-repeat" });

    expect(repository.startTool).toHaveBeenCalledWith(expect.objectContaining({ plannedDurationSeconds: 900 }));
    expect(repository.completeTool).toHaveBeenCalledTimes(2);
  });

  it("rejects tool starts for a closed or non-owned plan day", async () => {
    const repository = { findActivePlanDay: vi.fn().mockResolvedValue(null), startTool: vi.fn() };
    const start = createStartCareToolService(scope, { clock, repository: repository as never });

    await expect(start.start({ localDate: "2026-08-18", toolKey: "breathing", plannedDurationSeconds: 180, idempotencyKey: "closed-start" })).rejects.toThrow("CARE_DAY_CLOSED");
    expect(repository.startTool).not.toHaveBeenCalled();
  });
});
