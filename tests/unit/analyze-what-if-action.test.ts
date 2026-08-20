import { describe, expect, it, vi } from "vitest";
import { parseUnambiguousLocalEventTime } from "@/modules/planner/application/parse-local-event-time";

const mocks = vi.hoisted(() => ({
  requireUserScope: vi.fn(),
  createAnalysisRepository: vi.fn(),
  previewCaffeineWhatIf: vi.fn(),
  getPrismaClient: vi.fn(() => ({ database: "test" })),
}));

vi.mock("@/shared/auth/require-user-scope", () => ({ requireUserScope: mocks.requireUserScope }));
vi.mock("@/modules/analysis/infrastructure/prisma-analysis-repository", () => ({
  createAnalysisRepository: mocks.createAnalysisRepository,
}));
vi.mock("@/modules/planner/application/preview-what-if", () => ({
  previewCaffeineWhatIf: mocks.previewCaffeineWhatIf,
}));
vi.mock("@/shared/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));

import { previewCaffeineWhatIfAction } from "@/app/(app)/analyze/actions";

const formFor = (consumedAt: string) => {
  const formData = new FormData();
  formData.set("caffeineMg", "125");
  formData.set("consumedAt", consumedAt);
  return formData;
};

describe("previewCaffeineWhatIfAction", () => {
  it("converts scope-local wall time before previewing and only returns a record deep link", async () => {
    const consumedAt = "2026-02-03T22:15";
    mocks.requireUserScope.mockResolvedValue({ userId: "user-1", timezone: "America/New_York" });
    mocks.createAnalysisRepository.mockReturnValue({ repository: "analysis" });
    mocks.previewCaffeineWhatIf.mockResolvedValue({
      before: { readiness: 72 },
      after: { readiness: 68 },
      delta: -4,
    });

    const state = await previewCaffeineWhatIfAction({ status: "idle" }, formFor(consumedAt));

    expect(mocks.previewCaffeineWhatIf).toHaveBeenCalledWith(
      { userId: "user-1", timezone: "America/New_York" },
      { repository: "analysis" },
      {
        caffeineMg: 125,
        consumedAt: parseUnambiguousLocalEventTime(consumedAt, "America/New_York"),
      },
    );
    expect(state).toMatchObject({ status: "success", actualRecordHref: "/record/caffeine" });
    expect(JSON.stringify(state)).not.toContain(consumedAt);
    expect(JSON.stringify(state)).not.toContain("125");
    expect(mocks.createAnalysisRepository).toHaveBeenCalledOnce();
  });

  it("returns a rendered error state when the preview service cannot calculate", async () => {
    mocks.requireUserScope.mockResolvedValue({ userId: "user-1", timezone: "Asia/Seoul" });
    mocks.createAnalysisRepository.mockReturnValue({ repository: "analysis" });
    mocks.previewCaffeineWhatIf.mockRejectedValue(new Error("WHAT_IF_DATE_OUT_OF_RANGE"));

    const state = await previewCaffeineWhatIfAction({ status: "idle" }, formFor("2026-02-03T22:15"));

    expect(state).toMatchObject({ status: "error" });
  });
});
