import { afterEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const createDeleteMany = () => vi.fn().mockResolvedValue({ count: 0 });
  const sessionDeleteMany = createDeleteMany();
  const narrationDeleteMany = createDeleteMany();
  const impactFactorDeleteMany = createDeleteMany();
  const analysisSnapshotDeleteMany = createDeleteMany();
  const baselineSnapshotDeleteMany = createDeleteMany();
  const planRevisionDeleteMany = createDeleteMany();
  const planDayDeleteMany = createDeleteMany();
  const scheduleAdviceDeleteMany = createDeleteMany();
  const sleepPlanDeleteMany = createDeleteMany();
  const specialEventDeleteMany = createDeleteMany();
  const routineCompletionDeleteMany = createDeleteMany();
  const careToolSessionDeleteMany = createDeleteMany();
  const recordRevisionDeleteMany = createDeleteMany();
  const sleepSessionDeleteMany = createDeleteMany();
  const phoneUsageEntryDeleteMany = createDeleteMany();
  const caffeineEntryDeleteMany = createDeleteMany();
  const alcoholEntryDeleteMany = createDeleteMany();
  const mealEntryDeleteMany = createDeleteMany();
  const exerciseEntryDeleteMany = createDeleteMany();
  const wellnessEntryDeleteMany = createDeleteMany();
  const mutationReceiptDeleteMany = createDeleteMany();
  const dailyLogDeleteMany = createDeleteMany();
  const connectionDeleteMany = createDeleteMany();
  const userHabitDeleteMany = createDeleteMany();
  const sleepGoalDeleteMany = createDeleteMany();
  const userProfileDeleteMany = createDeleteMany();
  const accountDeleteMany = createDeleteMany();
  const userDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const verificationDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const transaction = {
    session: { deleteMany: sessionDeleteMany },
    narration: { deleteMany: narrationDeleteMany },
    impactFactor: { deleteMany: impactFactorDeleteMany },
    analysisSnapshot: { deleteMany: analysisSnapshotDeleteMany },
    baselineSnapshot: { deleteMany: baselineSnapshotDeleteMany },
    planRevision: { deleteMany: planRevisionDeleteMany },
    planDay: { deleteMany: planDayDeleteMany },
    scheduleAdvice: { deleteMany: scheduleAdviceDeleteMany },
    sleepPlan: { deleteMany: sleepPlanDeleteMany },
    specialEvent: { deleteMany: specialEventDeleteMany },
    routineCompletion: { deleteMany: routineCompletionDeleteMany },
    careToolSession: { deleteMany: careToolSessionDeleteMany },
    recordRevision: { deleteMany: recordRevisionDeleteMany },
    sleepSession: { deleteMany: sleepSessionDeleteMany },
    phoneUsageEntry: { deleteMany: phoneUsageEntryDeleteMany },
    caffeineEntry: { deleteMany: caffeineEntryDeleteMany },
    alcoholEntry: { deleteMany: alcoholEntryDeleteMany },
    mealEntry: { deleteMany: mealEntryDeleteMany },
    exerciseEntry: { deleteMany: exerciseEntryDeleteMany },
    wellnessEntry: { deleteMany: wellnessEntryDeleteMany },
    mutationReceipt: { deleteMany: mutationReceiptDeleteMany },
    dailyLog: { deleteMany: dailyLogDeleteMany },
    connection: { deleteMany: connectionDeleteMany },
    userHabit: { deleteMany: userHabitDeleteMany },
    sleepGoal: { deleteMany: sleepGoalDeleteMany },
    userProfile: { deleteMany: userProfileDeleteMany },
    account: { deleteMany: accountDeleteMany },
    user: { deleteMany: userDeleteMany },
    verification: { deleteMany: verificationDeleteMany },
  };
  const prisma = {
    $transaction: vi.fn(async (operation: (client: typeof transaction) => Promise<void>) => operation(transaction)),
  };
  return {
    prisma,
    userDeleteMany,
    verificationDeleteMany,
    planRevisionDeleteMany,
    caffeineEntryDeleteMany,
    dailyLogDeleteMany,
  };
});

const authBoundary = vi.hoisted(() => ({
  requireSessionIdentity: vi.fn(),
}));

vi.mock("@/shared/db/prisma", () => ({ getPrismaClient: () => database.prisma }));
vi.mock("@/shared/auth/require-session-user", () => ({
  requireSessionIdentity: authBoundary.requireSessionIdentity,
}));

import { DELETE as cleanupE2eUser } from "@/app/%5F_e2e/cleanup/route";
import { e2eIdentity } from "@/shared/auth/e2e-identity";

describe("E2E cleanup route", () => {
  afterEach(() => {
    delete process.env.ADAPTIVE_SLEEP_E2E_TEST_MODE;
    delete process.env.DATABASE_URL;
    vi.clearAllMocks();
  });

  it("accepts the setup identity cookie and deletes only that exact identity", async () => {
    process.env.ADAPTIVE_SLEEP_E2E_TEST_MODE = "1";
    process.env.DATABASE_URL = "file:./.tmp/task8-cleanup-e2e.sqlite";
    delete process.env.VERCEL_ENV;
    const input = { workerIndex: 7, namespace: "visual-cleanup" };
    const identity = e2eIdentity(input);
    const response = await cleanupE2eUser(new Request("http://localhost/__e2e/cleanup", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: `adaptive-sleep-e2e-user=${identity.id}`,
      },
      body: JSON.stringify(input),
    }));

    expect(response.status).toBe(200);
    expect(database.planRevisionDeleteMany).toHaveBeenCalledWith({ where: { userId: identity.id } });
    expect(database.caffeineEntryDeleteMany).toHaveBeenCalledWith({ where: { userId: identity.id } });
    expect(database.dailyLogDeleteMany).toHaveBeenCalledWith({ where: { userId: identity.id } });
    expect(database.userDeleteMany).toHaveBeenCalledTimes(1);
    expect(database.userDeleteMany).toHaveBeenCalledWith({ where: { id: identity.id } });
  });

  it("rejects a request body identity without an authenticated cleanup boundary", async () => {
    process.env.ADAPTIVE_SLEEP_E2E_TEST_MODE = "1";
    process.env.DATABASE_URL = "file:./.tmp/task8-cleanup-e2e.sqlite";
    delete process.env.VERCEL_ENV;
    const input = { workerIndex: 7, namespace: "visual-cleanup" };
    const response = await cleanupE2eUser(new Request("http://localhost/__e2e/cleanup", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }));

    expect(response.status).toBe(401);
    expect(database.userDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects a session for a different user even when its email matches the requested cleanup identity", async () => {
    process.env.ADAPTIVE_SLEEP_E2E_TEST_MODE = "1";
    process.env.DATABASE_URL = "file:./.tmp/task8-cleanup-e2e.sqlite";
    delete process.env.VERCEL_ENV;
    const input = { workerIndex: 7, namespace: "visual-cleanup" };
    const expected = e2eIdentity(input);
    authBoundary.requireSessionIdentity.mockResolvedValueOnce({
      userId: "different-user-id",
      email: expected.email,
    });
    const response = await cleanupE2eUser(new Request("http://localhost/__e2e/cleanup", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }));

    expect(response.status).toBe(401);
    expect(database.userDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects a session with the expected user id but a different non-null email", async () => {
    process.env.ADAPTIVE_SLEEP_E2E_TEST_MODE = "1";
    process.env.DATABASE_URL = "file:./.tmp/task8-cleanup-e2e.sqlite";
    delete process.env.VERCEL_ENV;
    const input = { workerIndex: 7, namespace: "visual-cleanup" };
    const expected = e2eIdentity(input);
    authBoundary.requireSessionIdentity.mockResolvedValueOnce({
      userId: expected.id,
      email: "different@example.com",
    });
    const response = await cleanupE2eUser(new Request("http://localhost/__e2e/cleanup", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }));

    expect(response.status).toBe(401);
    expect(database.userDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects a cookie for a different worker without deleting anything", async () => {
    process.env.ADAPTIVE_SLEEP_E2E_TEST_MODE = "1";
    process.env.DATABASE_URL = "file:./.tmp/task8-cleanup-e2e.sqlite";
    delete process.env.VERCEL_ENV;
    const expected = { workerIndex: 7, namespace: "visual-cleanup" };
    const other = e2eIdentity({ workerIndex: 8, namespace: "visual-cleanup" });
    const response = await cleanupE2eUser(new Request("http://localhost/__e2e/cleanup", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: `adaptive-sleep-e2e-user=${other.id}`,
      },
      body: JSON.stringify(expected),
    }));

    expect(response.status).toBe(401);
    expect(database.userDeleteMany).not.toHaveBeenCalled();
  });
});
