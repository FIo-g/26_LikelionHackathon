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
import HabitsPage from "@/app/(onboarding)/onboarding/habits/page";
import SleepGoalPage from "@/app/(onboarding)/onboarding/sleep-goal/page";
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

    expect(screen.getByRole("button", { name: "위치·수면·운동: 준비 중" })).toBeDisabled();
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
    const { container } = render(await ConnectPage());

    expect(screen.getByRole("button", { name: "직접 입력으로 시작하기" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "다음" })).not.toBeInTheDocument();
    expect(container.querySelector('input[name="selected"]')).toHaveValue("manual");
  });

  it("keeps the persisted habit enum values in radio controls", async () => {
    render(await HabitsPage());

    expect(screen.getByRole("radio", { name: "거의 안 마심" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "이른 편" })).toHaveAttribute("name", "meal");
    expect(screen.getByRole("radio", { name: "0~1회" })).toHaveAttribute("name", "exercise");
    expect(screen.getByRole("radio", { name: "낮음" })).toHaveAttribute("name", "phoneUsage");
  });

  it("submits the goal times through the existing named inputs", async () => {
    render(await SleepGoalPage());

    expect(screen.getByLabelText("취침 시간")).toHaveValue("23:00");
    expect(screen.getByLabelText("기상 시간")).toHaveValue("07:00");
    expect(screen.getByRole("button", { name: "다음" })).toHaveAttribute("type", "submit");
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
