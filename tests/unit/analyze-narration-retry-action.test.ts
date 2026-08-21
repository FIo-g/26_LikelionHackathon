import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserScope: vi.fn(),
  getPrismaClient: vi.fn(),
  createPrismaNarrationRepository: vi.fn(),
  createOpenAiNarrationProvider: vi.fn(),
  retryNarration: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/shared/auth/require-user-scope", () => ({ requireUserScope: mocks.requireUserScope }));
vi.mock("@/shared/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/modules/narration/infrastructure/prisma-narration-repository", () => ({
  createPrismaNarrationRepository: mocks.createPrismaNarrationRepository,
}));
vi.mock("@/modules/narration/infrastructure/openai-narration-provider", () => ({
  createOpenAiNarrationProvider: mocks.createOpenAiNarrationProvider,
}));
vi.mock("@/modules/narration/application/generate-narration", () => ({ retryNarration: mocks.retryNarration }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { retryNarrationAction } from "@/app/(app)/analyze/actions";

const formFor = (narrationId?: string) => {
  const formData = new FormData();
  if (narrationId) formData.set("narrationId", narrationId);
  return formData;
};

describe("retryNarrationAction", () => {
  const scope = { userId: "retry-user", timezone: "Asia/Seoul" };
  const prisma = { database: "test" };
  const repository = { narration: "repository" };
  const provider = { narration: "provider" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUserScope.mockResolvedValue(scope);
    mocks.getPrismaClient.mockReturnValue(prisma);
    mocks.createPrismaNarrationRepository.mockReturnValue(repository);
    mocks.createOpenAiNarrationProvider.mockReturnValue(provider);
  });

  it("rejects a missing narration id before opening an authenticated persistence path", async () => {
    await expect(retryNarrationAction({ status: "idle" }, formFor())).resolves.toMatchObject({ status: "error" });

    expect(mocks.requireUserScope).not.toHaveBeenCalled();
    expect(mocks.retryNarration).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("uses the current authenticated scope and refreshes Analyze after an AI-ready retry", async () => {
    mocks.retryNarration.mockResolvedValue("ready");

    await expect(retryNarrationAction({ status: "idle" }, formFor("narration-1"))).resolves.toMatchObject({ status: "success" });

    expect(mocks.createPrismaNarrationRepository).toHaveBeenCalledWith(prisma, scope);
    expect(mocks.retryNarration).toHaveBeenCalledWith("narration-1", { provider, repository });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/analyze");
  });

  it("keeps the honest fallback state mounted when a configured model failed after persistence", async () => {
    mocks.retryNarration.mockResolvedValue("template-fallback");

    const state = await retryNarrationAction({ status: "idle" }, formFor("narration-1"));

    expect(state).toMatchObject({ status: "fallback" });
    expect(state).not.toHaveProperty("narrationId");

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not consume a missing-model retry or refresh Analyze as if an AI report existed", async () => {
    mocks.retryNarration.mockResolvedValue("unavailable");

    await expect(retryNarrationAction({ status: "idle" }, formFor("narration-1"))).resolves.toMatchObject({ status: "fallback" });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps ownership, retry-limit, and unexpected failures as controlled errors", async () => {
    mocks.retryNarration.mockResolvedValueOnce("not-retryable");
    await expect(retryNarrationAction({ status: "idle" }, formFor("narration-1"))).resolves.toMatchObject({ status: "error" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();

    mocks.retryNarration.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(retryNarrationAction({ status: "idle" }, formFor("narration-1"))).resolves.toMatchObject({ status: "error" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
