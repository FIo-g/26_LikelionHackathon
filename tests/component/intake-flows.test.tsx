import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { CaffeineFlow } from "@/modules/records/ui/caffeine-flow";
import { AlcoholFlow } from "@/modules/records/ui/alcohol-flow";
import { MealHealthFlow } from "@/modules/records/ui/meal-health-form";
import { SleepPhoneFlow } from "@/modules/records/ui/sleep-phone-form";

describe("intake flows", () => {
  it("renders caffeine brand step", () => {
    render(<CaffeineFlow timezone="Asia/Seoul" step="brand" />);

    expect(screen.getByRole("heading", { name: "카페인 기록" })).toBeVisible();
    expect(screen.getByLabelText("브랜드")).toBeVisible();
  });

  it("renders caffeine confirmation step", () => {
    render(
      <CaffeineFlow
        timezone="Asia/Seoul"
        step="confirm"
        initialValues={{
          brand: "루이비스",
          product: "핸디캡",
          caffeineMg: "120",
          consumedAt: "2026-08-20T08:00",
        }}
      />,
    );

    expect(screen.getByText("입력 확인")).toBeVisible();
    expect(screen.getByRole("button", { name: "카페인 저장" })).toBeVisible();
  });

  it("renders alcohol flow amount step", () => {
    render(
      <AlcoholFlow
        timezone="Asia/Seoul"
        step="amount"
        initialValues={{ alcoholType: "맥주" }}
      />,
    );

    expect(screen.getByLabelText("잔 수")).toBeVisible();
  });

  it("renders meal-health confirm step", () => {
    render(
      <MealHealthFlow
        timezone="Asia/Seoul"
        step="confirm"
        initialValues={{
          mealSize: "medium",
          mealEatenAt: "2026-08-20T12:30",
          mealNotes: "점심",
          exerciseType: "조깅",
          exerciseIntensity: "medium",
          exerciseStartedAt: "2026-08-20T12:40",
          exerciseEndedAt: "2026-08-20T13:10",
          fatigueLevel: "2",
          stressLevel: "3",
          wellnessLocalDate: "2026-08-20",
        }}
      />,
    );

    expect(screen.getByText("입력 확인")).toBeVisible();
    expect(screen.getByRole("button", { name: "식사/운동/컨디션 저장" })).toBeVisible();
  });

  it("renders sleep-phone confirm step", () => {
    render(
      <SleepPhoneFlow
        timezone="Asia/Seoul"
        step="confirm"
        initialValues={{
          sleepStartedAt: "2026-08-19T23:00",
          sleepEndedAt: "2026-08-20T07:00",
          morningFatigue: "3",
          lastUseAt: "2026-08-20T22:00",
          durationMinutes: "60",
        }}
      />,
    );

    expect(screen.getByText("입력 확인")).toBeVisible();
    expect(screen.getByRole("button", { name: "수면/휴대폰 저장" })).toBeVisible();
  });
});
