import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserScope: vi.fn(),
  getPrismaClient: vi.fn(),
  createAnalysisRepository: vi.fn(),
  createPrismaNarrationRepository: vi.fn(),
  createOpenAiNarrationProvider: vi.fn(),
  attemptCurrentAnalysisNarration: vi.fn(),
  retryNarration: vi.fn(),
  revalidatePath: vi.fn(),
  systemClock: { now: vi.fn() },
}));

vi.mock("@/shared/auth/require-user-scope", () => ({ requireUserScope: mocks.requireUserScope }));
vi.mock("@/shared/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/modules/analysis/infrastructure/prisma-analysis-repository", () => ({
  createAnalysisRepository: mocks.createAnalysisRepository,
}));
vi.mock("@/modules/narration/infrastructure/prisma-narration-repository", () => ({
  createPrismaNarrationRepository: mocks.createPrismaNarrationRepository,
}));
vi.mock("@/modules/narration/infrastructure/openai-narration-provider", () => ({
  createOpenAiNarrationProvider: mocks.createOpenAiNarrationProvider,
}));
vi.mock("@/modules/narration/application/attempt-current-analysis-narration", () => ({
  attemptCurrentAnalysisNarration: mocks.attemptCurrentAnalysisNarration,
}));
vi.mock("@/modules/narration/application/generate-narration", () => ({ retryNarration: mocks.retryNarration }));
vi.mock("@/shared/time/system-clock", () => ({ systemClock: mocks.systemClock }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { attemptNarrationAction } from "@/app/(app)/analyze/actions";

describe("attemptNarrationAction", () => {
  const scope = { userId: "analysis-user", timezone: "Asia/Seoul" };
  const prisma = { database: "test" };
  const analysisRepository = { analysis: "repository" };
  const narrationRepository = { narration: "repository" };
  const provider = { narration: "provider" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUserScope.mockResolvedValue(scope);
    mocks.getPrismaClient.mockReturnValue(prisma);
    mocks.createAnalysisRepository.mockReturnValue(analysisRepository);
    mocks.createPrismaNarrationRepository.mockReturnValue(narrationRepository);
    mocks.createOpenAiNarrationProvider.mockReturnValue(provider);
  });

  it("constructs the attempt exclusively from authenticated server-side scope and dependencies", async () => {
    mocks.attemptCurrentAnalysisNarration.mockResolvedValue({ status: "ready" });

    const state = await attemptNarrationAction({ status: "idle" }, new FormData());

    expect(state).toMatchObject({ status: "success" });
    expect(state).not.toHaveProperty("narrationId");

    expect(mocks.createAnalysisRepository).toHaveBeenCalledWith(prisma, scope);
    expect(mocks.createPrismaNarrationRepository).toHaveBeenCalledWith(prisma, scope);
    expect(mocks.attemptCurrentAnalysisNarration).toHaveBeenCalledWith(scope, {
      clock: mocks.systemClock,
      analysisRepository,
      narrationDependencies: { provider, repository: narrationRepository },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/analyze");
  });

  it("does not revalidate or pretend to create a report when no trusted current snapshot exists", async () => {
    mocks.attemptCurrentAnalysisNarration.mockResolvedValue({ status: "not-available" });

    await expect(attemptNarrationAction({ status: "idle" }, new FormData())).resolves.toMatchObject({ status: "error" });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["template-fallback", "unavailable"] as const)("keeps the persisted fallback feedback mounted after %s", async (status) => {
    mocks.attemptCurrentAnalysisNarration.mockResolvedValue({ status, narrationId: "own-narration-1" });

    await expect(attemptNarrationAction({ status: "idle" }, new FormData())).resolves.toMatchObject({
      status: "fallback",
      narrationId: "own-narration-1",
    });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refreshes an idempotent existing report without presenting it as a failed mutation", async () => {
    mocks.attemptCurrentAnalysisNarration.mockResolvedValue({ status: "already-exists" });

    await expect(attemptNarrationAction({ status: "idle" }, new FormData())).resolves.toMatchObject({ status: "success" });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/analyze");
  });

  it("turns authentication, database, and provider setup failures into a controlled error", async () => {
    mocks.attemptCurrentAnalysisNarration.mockRejectedValue(new Error("database unavailable"));

    await expect(attemptNarrationAction({ status: "idle" }, new FormData())).resolves.toMatchObject({ status: "error" });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
