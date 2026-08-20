import { describe, expect, it, vi } from "vitest";
import type { APIRequestContext, TestInfo } from "@playwright/test";

import {
  e2eTestIdentity,
  setupE2eUser,
  setupIncompleteOnboardingE2eUser,
  takeSeededE2eIdentityForCleanup,
} from "../e2e/fixtures";

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
    const post = vi.fn(async () => ({ ok: () => true }));
    const request = { post } as unknown as APIRequestContext;

    await setupE2eUser(request, info);

    const identity = e2eTestIdentity(info);
    expect(post).toHaveBeenCalledWith("/__e2e/setup", {
      data: { workerIndex: info.workerIndex, namespace: identity.namespace },
    });
    expect(takeSeededE2eIdentityForCleanup(info)).toEqual(identity);
    expect(takeSeededE2eIdentityForCleanup(info)).toBeNull();
  });

  it("tracks the isolated incomplete-onboarding setup for the same cleanup path", async () => {
    const info = testInfo("completes onboarding through the authenticated UI");
    const post = vi.fn(async () => ({ ok: () => true }));
    const request = { post } as unknown as APIRequestContext;

    await setupIncompleteOnboardingE2eUser(request, info);

    expect(post).toHaveBeenCalledWith("/__e2e/setup?onboarding=incomplete", {
      data: { workerIndex: info.workerIndex, namespace: e2eTestIdentity(info).namespace },
    });
    expect(takeSeededE2eIdentityForCleanup(info)).toEqual(e2eTestIdentity(info));
    expect(takeSeededE2eIdentityForCleanup(info)).toBeNull();
  });
});
