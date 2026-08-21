import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const actionState = vi.hoisted(() => ({
  attempt: {
    status: "fallback" as const,
    message: "AI 리포트를 준비하지 못해 기본 리포트를 준비했어요.",
    narrationId: "own-narration-1",
  },
  dispatch: vi.fn(),
  retry: { status: "idle" as const },
}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useActionState: vi.fn((action: unknown) => (
      action === attemptNarrationAction
        ? [actionState.attempt, actionState.dispatch, false]
        : [actionState.retry, actionState.dispatch, false]
    )),
  };
});

import { attemptNarrationAction } from "@/app/(app)/analyze/actions";
import { AnalysisReport } from "@/modules/analysis/ui/analysis-report";

describe("AnalysisReport initial narration fallback", () => {
  it("immediately replaces the initial attempt with a retry bound to the server-returned narration", () => {
    const { container } = render(
      <AnalysisReport
        attemptAvailable
        narration={null}
        report={{ status: "template-fallback", headline: "기본 리포트", body: "본문", bullets: [] }}
      />,
    );

    expect(screen.getByText("AI 리포트를 준비하지 못해 기본 리포트를 준비했어요.")).toBeVisible();
    expect(screen.getByRole("button", { name: "리포트 다시 시도" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "AI 리포트 시도" })).not.toBeInTheDocument();
    expect(container.querySelector('input[name="narrationId"]')).toHaveValue("own-narration-1");
  });
});
