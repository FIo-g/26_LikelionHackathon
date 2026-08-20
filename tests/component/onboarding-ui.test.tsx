import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { DeviceConnectOption } from "@/modules/onboarding/ui/device-connect-option";
import { submitConnectAction } from "@/app/(onboarding)/onboarding/connect/actions";
import { submitSleepGoalAction } from "@/app/(onboarding)/onboarding/sleep-goal/actions";
import { submitHabitsAction } from "@/app/(onboarding)/onboarding/habits/actions";
import { submitProfileAction } from "@/app/(onboarding)/onboarding/profile/actions";
import { onboardingTimezoneOptions } from "@/app/(onboarding)/onboarding/profile/page";
import ConnectPage from "@/app/(onboarding)/onboarding/connect/page";
import HabitsPage from "@/app/(onboarding)/onboarding/habits/page";
import ProfilePage from "@/app/(onboarding)/onboarding/profile/page";
import SleepGoalPage from "@/app/(onboarding)/onboarding/sleep-goal/page";
import { completeOnboarding } from "@/modules/onboarding/application/complete-onboarding";
import { saveConnectStep } from "@/modules/onboarding/application/save-connect-step";
import { saveHabitsStep } from "@/modules/onboarding/application/save-habits-step";
import { saveSleepGoalStep } from "@/modules/onboarding/application/save-sleep-goal-step";

const onboardingRepositoryMock = vi.hoisted(() => ({
  getProgress: vi.fn(),
}));

const fullyPersistedProgress = () => ({
  connect: { selected: "manual" as const },
  sleepGoal: { targetBedTime: "23:30", targetWakeTime: "07:00", targetDurationMinutes: 450 },
  habits: { caffeine: "sometimes" as const, exercise: "weekly" as const, meal: "mixed" as const, alcohol: "weekly" as const, phoneUsage: "low" as const },
  profile: { nickname: "tester", timezone: "Asia/Seoul", age: 25, gender: "female" as const, heightCm: 165, weightKg: 58 },
});

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
vi.mock("@/modules/onboarding/application/save-profile-step", () => ({
  saveProfileStep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/onboarding/application/complete-onboarding", () => ({
  completeOnboarding: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/onboarding/infrastructure/prisma-onboarding-repository", () => ({
  createOnboardingRepository: vi.fn(() => ({
    getProgress: onboardingRepositoryMock.getProgress,
  })),
}));

describe("Onboarding UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onboardingRepositoryMock.getProgress.mockResolvedValue(fullyPersistedProgress());
  });

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

    expect(screen.getByRole("button", { name: "워치 수면·운동: 준비 중" })).toBeDisabled();
    expect(screen.queryByText("연동 완료")).not.toBeInTheDocument();
  });

  it.each([
    ["connect", submitConnectAction, { selected: "manual" }],
    ["sleep goal", submitSleepGoalAction, { targetBedTime: "23:30", targetWakeTime: "07:00" }],
    ["habits", submitHabitsAction, { caffeine: "none", exercise: "rare", meal: "mixed", alcohol: "none", phoneUsage: "low" }],
    ["profile", submitProfileAction, { nickname: "tester", timezone: "Asia/Seoul", age: "25", gender: "female", heightCm: "165", weightKg: "58" }],
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

  it("does not offer a next-step link that skips saving the final connection choice", async () => {
    const { container } = render(await ConnectPage());

    expect(screen.getByRole("button", { name: "수면 플랜 시작하기" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "다음" })).not.toBeInTheDocument();
    expect(container.querySelector('input[name="selected"]')).toHaveValue("manual");
  });

  it("keeps the persisted Figma habit choices in radio controls", async () => {
    render(await HabitsPage());

    expect(screen.getByRole("radio", { name: "1잔 내외" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "2회" })).toHaveAttribute("name", "meal");
    expect(screen.getByRole("radio", { name: "1~2회" })).toHaveAttribute("name", "alcohol");
    expect(screen.getByRole("radio", { name: "2~3회" })).toHaveAttribute("name", "exercise");
  });

  it("keeps Figma's resting goal card and exposes time inputs through its edit control", async () => {
    render(await SleepGoalPage());

    expect(screen.getByText("23:30")).toBeVisible();
    expect(screen.queryByLabelText("취침 시간")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "시간 수정" }));
    expect(screen.getByLabelText("취침 시간")).toHaveValue("23:30");
    expect(screen.getByLabelText("기상 시간")).toHaveValue("07:00");
    expect(screen.getByRole("button", { name: "다음" })).toHaveAttribute("type", "submit");
  });

  it("renders every persisted profile field before moving to habits", async () => {
    render(await ProfilePage());

    expect(screen.getByLabelText("닉네임")).toHaveValue("tester");
    expect(screen.getByLabelText("나이")).toHaveValue(25);
    expect(screen.getByRole("radio", { name: "여성" })).toBeChecked();
    expect(screen.getByLabelText("키")).toHaveValue(165);
    expect(screen.getByLabelText("몸무게")).toHaveValue(58);
    expect(screen.getByLabelText("생활 시간대")).toHaveValue("Asia/Seoul");
    expect(screen.getByRole("button", { name: "다음" })).toHaveAttribute("type", "submit");
  });

  it("returns a concurrent incomplete final step to the earliest missing prerequisite", async () => {
    vi.mocked(completeOnboarding).mockRejectedValueOnce(new Error("INCOMPLETE_ONBOARDING"));
    const formData = new FormData();
    formData.set("selected", "manual");

    await expect(submitConnectAction(formData)).rejects.toMatchObject({
      digest: expect.stringContaining("/onboarding/profile"),
    });
  });

  it("fails closed for direct actions that skip a persisted prerequisite", async () => {
    onboardingRepositoryMock.getProgress
      .mockResolvedValueOnce({ ...fullyPersistedProgress(), profile: null })
      .mockResolvedValueOnce({ ...fullyPersistedProgress(), habits: null })
      .mockResolvedValueOnce({ ...fullyPersistedProgress(), sleepGoal: null });

    const habitFormData = new FormData();
    habitFormData.set("caffeine", "none");
    habitFormData.set("exercise", "rare");
    habitFormData.set("meal", "mixed");
    habitFormData.set("alcohol", "none");
    habitFormData.set("phoneUsage", "low");
    await expect(submitHabitsAction(habitFormData)).rejects.toMatchObject({
      digest: expect.stringContaining("/onboarding/profile"),
    });
    expect(saveHabitsStep).not.toHaveBeenCalled();

    const goalFormData = new FormData();
    goalFormData.set("targetBedTime", "23:30");
    goalFormData.set("targetWakeTime", "07:00");
    await expect(submitSleepGoalAction(goalFormData)).rejects.toMatchObject({
      digest: expect.stringContaining("/onboarding/habits"),
    });
    expect(saveSleepGoalStep).not.toHaveBeenCalled();

    const connectFormData = new FormData();
    connectFormData.set("selected", "manual");
    await expect(submitConnectAction(connectFormData)).rejects.toMatchObject({
      digest: expect.stringContaining("/onboarding/sleep-goal"),
    });
    expect(saveConnectStep).not.toHaveBeenCalled();
    expect(completeOnboarding).not.toHaveBeenCalled();
  });
});
