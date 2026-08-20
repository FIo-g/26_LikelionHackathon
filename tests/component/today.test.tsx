import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { TodayScreen } from "@/modules/analysis/ui/today-screen";
import type { TodayViewModel } from "@/modules/analysis/application/get-today-view-model";

const nowReadyModel: TodayViewModel = {
  localDate: "2026-08-20",
  readiness: {
    state: "ready",
    data: {
      score: 80,
      confidence: "high",
      label: "80점 (좋음)",
    },
    message: null,
    action: null,
  },
  dataStatus: {
    state: "ready",
    data: {
      completedCategories: 7,
      totalCategories: 7,
      missingLabels: [],
    },
    message: null,
    action: null,
  },
  preparationTimeline: {
    state: "ready",
    data: [
      { key: "caffeine", label: "카페인 마감", scheduledAt: "15:00", status: "done" },
      { key: "exercise", label: "운동 마감", scheduledAt: "18:00", status: "current" },
      { key: "meal", label: "식사 마감", scheduledAt: "19:00", status: "upcoming" },
      { key: "windDown", label: "휴대폰 디지털 디톡스 시작", scheduledAt: "22:00", status: "upcoming" },
    ],
    message: "오늘 목표 취침 23:00 기준",
    action: null,
  },
  recordSummary: {
    state: "ready",
    data: [
      { type: "caffeine", label: "카페인", presence: "completed", href: "/record/caffeine?step=brand" },
      { type: "alcohol", label: "음주", presence: "completed", href: "/record/alcohol?step=type" },
      { type: "meal", label: "식사", presence: "empty", href: "/record/meal-health?step=meal" },
      { type: "exercise", label: "운동", presence: "completed", href: "/record/meal-health?step=exercise-and-wellness" },
      { type: "sleep", label: "수면", presence: "completed", href: "/record/sleep-phone?step=sleep" },
      { type: "phone-usage", label: "휴대폰", presence: "completed", href: "/record/sleep-phone?step=phone" },
      { type: "wellness", label: "컨디션", presence: "completed", href: "/record/meal-health?step=exercise-and-wellness" },
    ],
    message: "오늘 기록 6개 완료",
    action: null,
  },
};

const staleReadinessModel: TodayViewModel = {
  ...nowReadyModel,
  localDate: "2026-08-20",
  readiness: {
    state: "stale",
    data: nowReadyModel.readiness.data,
    message: "마지막 정상 분석을 표시합니다",
    action: null,
  },
  recordSummary: {
    ...nowReadyModel.recordSummary,
    state: "ready",
    data: [
      { type: "caffeine", label: "카페인", presence: "completed", href: "/record/caffeine?step=brand" },
      { type: "alcohol", label: "음주", presence: "completed", href: "/record/alcohol?step=type" },
      { type: "meal", label: "식사", presence: "completed", href: "/record/meal-health?step=meal" },
      { type: "exercise", label: "운동", presence: "completed", href: "/record/meal-health?step=exercise-and-wellness" },
      { type: "sleep", label: "수면", presence: "completed", href: "/record/sleep-phone?step=sleep" },
      { type: "phone-usage", label: "휴대폰", presence: "completed", href: "/record/sleep-phone?step=phone" },
      { type: "wellness", label: "컨디션", presence: "completed", href: "/record/meal-health?step=exercise-and-wellness" },
    ],
    message: "오늘 기록 7개 완료",
  },
};

const noScoreModel: TodayViewModel = {
  ...nowReadyModel,
  readiness: {
    ...nowReadyModel.readiness,
    state: "ready",
    data: {
      score: null,
      confidence: "low",
      label: "점수 산출 불가 (낮음)",
    },
  },
};

describe("TodayScreen", () => {
  it("shows stale readiness while keeping record summary", () => {
    render(<TodayScreen viewModel={staleReadinessModel} />);

    expect(screen.getByText("마지막 정상 분석을 표시합니다")).toBeVisible();
    expect(screen.getByText("오늘 기록 7개 완료")).toBeVisible();
    expect(screen.getByRole("progressbar")).toBeVisible();
  });

  it("shows score label without a fake progress bar when score is missing", () => {
    render(<TodayScreen viewModel={noScoreModel} />);

    expect(screen.getByText("점수 산출 불가 (낮음)")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders timeline and record links with exact routes", () => {
    render(<TodayScreen viewModel={nowReadyModel} />);

    const timeline = screen.getByRole("list", { name: "준비 타임라인" });
    expect(timeline).toBeVisible();
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(4);

    expect(screen.getByRole("link", { name: "기록하기" })).toHaveAttribute("href", "/record/meal-health?step=meal");

    const caffeineItem = screen.getByText("카페인", { exact: true }).closest("li");
    expect(caffeineItem).toBeInstanceOf(HTMLLIElement);
    if (caffeineItem) {
      expect(within(caffeineItem).getByRole("link", { name: "수정하기" })).toHaveAttribute("href", "/record/caffeine?step=brand");
    }
  });
});
