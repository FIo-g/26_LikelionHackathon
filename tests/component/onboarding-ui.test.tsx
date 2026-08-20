import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { DeviceConnectOption } from "@/modules/onboarding/ui/device-connect-option";
import { submitConnectAction } from "@/app/(onboarding)/onboarding/connect/actions";
import { submitSleepGoalAction } from "@/app/(onboarding)/onboarding/sleep-goal/actions";
import { submitHabitsAction } from "@/app/(onboarding)/onboarding/habits/actions";
import { submitProfileAction } from "@/app/(onboarding)/onboarding/profile/actions";
import { onboardingTimezoneOptions } from "@/app/(onboarding)/onboarding/profile/page";
import ConnectPage from "@/app/(onboarding)/onboarding/connect/page";
import { completeOnboarding } from "@/modules/onboarding/application/complete-onboarding";

vi.mock("@/shared/auth/require-session-user", () => ({
  requireSessionUserId: vi.fn().mockResolvedValue("onboarding-action-user"),
}));
vi.mock("@/modules/onboarding/application/save-connect-step", () => ({
  saveConnectStep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/onboarding/application/save-sleep-goal-step", () => ({
  saveSleepGoalStep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/onboarding/application/save-habits-step", () => ({
  saveHabitsStep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/onboarding/application/complete-onboarding", () => ({
  completeOnboarding: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/onboarding/infrastructure/prisma-onboarding-repository", () => ({
  createOnboardingRepository: vi.fn(() => ({
    getProgress: vi.fn().mockResolvedValue({
      connect: null,
      sleepGoal: null,
      habits: null,
      profile: null,
    }),
  })),
}));

describe("Onboarding UI", () => {
  it("renders 4 progress items and current step label", () => {
    render(<OnboardingProgress currentStep={2} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByLabelText("2단계, 현재 단계")).toBeVisible();
  });

  it("renders coming-soon wearable card as preparing", () => {
    render(
      <DeviceConnectOption
        type="wearable"
        availability="coming-soon"
        selected={false}
        state="unavailable"
      />,
    );

    expect(screen.getAllByText("준비 중")).toHaveLength(2);
    expect(screen.queryByText("연동 완료")).not.toBeInTheDocument();
  });

  it.each([
    ["connect", submitConnectAction, { selected: "manual" }],
    ["sleep goal", submitSleepGoalAction, { targetBedTime: "23:00", targetWakeTime: "07:00" }],
    ["habits", submitHabitsAction, { caffeine: "none", exercise: "rare", meal: "mixed", phoneUsage: "low" }],
    ["profile", submitProfileAction, { nickname: "tester", timezone: "Asia/Seoul" }],
  ])("accepts FormData as the first direct form-action argument for %s", async (_name, action, values) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) formData.set(key, value);
    formData.set("$ACTION_ID_test", "ignored-by-validation");

    await expect((action as (input: FormData) => Promise<unknown>)(formData))
      .rejects.toThrow("NEXT_REDIRECT");
  });

  it("includes Korea in the selectable onboarding timezones", () => {
    expect(onboardingTimezoneOptions).toContain("Asia/Seoul");
  });

  it("does not offer a next-step link that skips saving the connection", async () => {
    render(await ConnectPage());

    expect(screen.getByRole("button", { name: "연결하기" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "다음" })).not.toBeInTheDocument();
  });

  it("returns an incomplete onboarding flow to the saved connection step", async () => {
    vi.mocked(completeOnboarding).mockRejectedValueOnce(new Error("INCOMPLETE_ONBOARDING"));
    const formData = new FormData();
    formData.set("nickname", "tester");
    formData.set("timezone", "Asia/Seoul");

    await expect(submitProfileAction(formData)).rejects.toMatchObject({
      digest: expect.stringContaining("/onboarding/connect"),
    });
  });
});
