import { describe, expect, it } from "vitest";

import { createRecordService } from "@/modules/records/application/record-service";
import type { RecordRepository } from "@/modules/records/application/ports";
import type { RecordEntity } from "@/modules/records/domain/types";
import type { PlannerRepository } from "@/modules/planner/application/ports";

const scope = { userId: "user-1", timezone: "Asia/Seoul" };
const clock = { now: () => new Date("2026-08-22T13:00:00.000Z") };
const caffeine = (caffeineMg: number) => ({ type: "caffeine" as const, brand: "테스트", product: "커피", caffeineMg, consumedAt: new Date("2026-08-22T12:30:00.000Z"), timezone: "Asia/Seoul" });

describe("RecordService rerouting", () => {
  it("recomputes from listOwnedRecords after a batch save and a delete", async () => {
    const records: RecordEntity[] = [];
    const saved: Array<{
      inputSnapshot: {
        rerouteRecords: readonly {
          id: string;
          type: string;
          input: Record<string, string | number | null>;
        }[];
      };
    }> = [];
    let listCalls = 0;
    const recordRepository: RecordRepository = {
      findById: async (_type, id) => records.find((record) => record.id === id) ?? null,
      listOwnedRecords: async () => { listCalls += 1; return records.map((record) => ({ ...record })); },
      create: async (_type, input) => {
        const record = { ...input, id: `record-${records.length + 1}`, userId: scope.userId, localDate: "2026-08-22" } as RecordEntity;
        records.push(record);
        return record;
      },
      update: async () => { throw new Error("not used"); },
      delete: async (_type, id) => { const index = records.findIndex((record) => record.id === id); if (index >= 0) records.splice(index, 1); },
      appendRevision: async () => undefined,
    };
    const plannerRepository: PlannerRepository = {
      createEvent: async () => ({ eventId: "event-1" }), saveGeneratedAdvice: async (input) => { saved.push(input as typeof saved[number]); return { adviceId: `advice-${saved.length}` }; },
      findAdvice: async () => null, findAdviceByInputHash: async () => null,
      findCurrentGoal: async () => ({ targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 }), findCurrentBaseline: async () => null,
      findActivePlan: async () => ({ id: "plan-1", status: "active" }),
      listActiveDays: async () => [{ id: "day-1", planId: "plan-1", localDate: "2026-08-22", targetBedAt: "2026-08-22T15:00:00.000Z", targetWakeAt: "2026-08-22T23:00:00.000Z", caffeineCutoffAt: "2026-08-22T08:00:00.000Z", exerciseCutoffAt: "2026-08-22T11:00:00.000Z", mealCutoffAt: "2026-08-22T12:00:00.000Z", windDownAt: "2026-08-22T14:00:00.000Z", status: "active" }],
      listEvents: async () => [], findLatestGeneratedAdvice: async () => null, findLatestDismissedAdvice: async () => null, findPlanForEvent: async () => null,
      acceptAdvice: async () => ({ planId: "plan-1", revisionId: "revision-1", changedDates: [] }), dismissAdvice: async () => undefined,
      supersedeGeneratedAdvice: async () => undefined,
    };
    const service = createRecordService(scope, {
      clock,
      getPrisma: () => ({ $transaction: async (work) => work({ sleepPlan: {} } as never) }),
      recordRepositoryFactory: () => recordRepository,
      mutationReceiptRepositoryFactory: () => ({ execute: async (_command, work) => work() }),
      plannerRepositoryFactory: () => plannerRepository,
    });

    const batch = await service.saveBatch({ idempotencyKey: "batch-1", items: [{ clientKey: "first", recordId: null, input: caffeine(120) }, { clientKey: "second", recordId: null, input: caffeine(180) }] });
    await service.delete({ idempotencyKey: "delete-1", recordId: batch.records[0]!.recordId, recordType: "caffeine" });

    expect(listCalls).toBe(2);
    expect(saved.at(-1)?.inputSnapshot.rerouteRecords).toEqual([{
      id: batch.records[1]!.recordId,
      type: "caffeine",
      input: {
        type: "caffeine",
        brand: "테스트",
        product: "커피",
        caffeineMg: 180,
        consumedAt: "2026-08-22T12:30:00.000Z",
        timezone: "Asia/Seoul",
      },
    }]);
  });
});
