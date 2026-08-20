import { afterEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const userDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const verificationDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const transaction = {
    user: { deleteMany: userDeleteMany },
    verification: { deleteMany: verificationDeleteMany },
  };
  const prisma = {
    $transaction: vi.fn(async (operation: (client: typeof transaction) => Promise<void>) => operation(transaction)),
  };
  return { prisma, userDeleteMany, verificationDeleteMany };
});

vi.mock("@/shared/db/prisma", () => ({ getPrismaClient: () => database.prisma }));

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
    expect(database.userDeleteMany).toHaveBeenCalledTimes(1);
    expect(database.userDeleteMany).toHaveBeenCalledWith({ where: { id: identity.id } });
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
