import { describe, expect, it, vi } from "vitest";
import type { APIRequestContext, TestInfo } from "@playwright/test";

import { e2eTestIdentity, setupE2eUser, takeSeededE2eIdentityForCleanup } from "../e2e/fixtures";

const testInfo = (title: string): TestInfo => ({
  workerIndex: 3,
  titlePath: ["chromium", "e2e", title],
}) as TestInfo;

describe("E2E fixture cleanup tracking", () => {
  it("does not cleanup an identity for a test that never used setup", () => {
    expect(takeSeededE2eIdentityForCleanup(testInfo("protects today route without session"))).toBeNull();
  });

  it("cleans up a successfully setup identity exactly once through the worker namespace", async () => {
    const info = testInfo("renders today for an E2E user");
    const request = {
      post: vi.fn(async () => ({ ok: () => true })),
    } as unknown as APIRequestContext;

    await setupE2eUser(request, info);

    const identity = e2eTestIdentity(info);
    expect(takeSeededE2eIdentityForCleanup(info)).toEqual(identity);
    expect(takeSeededE2eIdentityForCleanup(info)).toBeNull();
  });
});
