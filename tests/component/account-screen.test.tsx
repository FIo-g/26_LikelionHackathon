import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountScreen } from "@/modules/account/ui/account-screen";

const viewModel = {
  identity: { email: "alice@example.test" },
  profile: { nickname: "Alice", timezone: "Asia/Seoul" },
  sleepGoal: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
  connections: [
    { type: "manual", label: "직접 입력", mode: "manual", availability: "available", state: "needs-input", lastSyncedAt: null },
    { type: "wearable", label: "웨어러블", mode: "automatic", availability: "coming-soon", state: "unavailable", lastSyncedAt: null },
    { type: "phone", label: "휴대폰", mode: "automatic", availability: "coming-soon", state: "unavailable", lastSyncedAt: null },
    { type: "calendar", label: "캘린더", mode: "automatic", availability: "coming-soon", state: "unavailable", lastSyncedAt: null },
  ],
  manualInputCategories: [
    { key: "sleep", label: "수면" }, { key: "phone", label: "휴대폰" }, { key: "caffeine", label: "카페인" }, { key: "alcohol", label: "음주" }, { key: "meal", label: "식사" }, { key: "exercise", label: "운동" }, { key: "wellness", label: "웰니스" },
  ],
  dataManagement: { exportRequiresReauth: true, deleteRequiresReauth: true },
} as const;

describe("AccountScreen", () => {
  it("truthfully distinguishes direct input from unavailable automatic connections", () => {
    render(<AccountScreen viewModel={viewModel} />);

    expect(screen.getByText("직접 입력 사용 중")).toBeVisible();
    expect(screen.getByText("웨어러블 연동 준비 중")).toBeVisible();
    expect(screen.getByText("휴대폰 연동 준비 중")).toBeVisible();
    expect(screen.getByText("캘린더 연동 준비 중")).toBeVisible();
    expect(screen.queryByText("자동 입력 중")).not.toBeInTheDocument();
    expect(screen.getByText("수면")).toBeVisible();
    expect(screen.getByText("웰니스")).toBeVisible();
  });

  it("traps Tab in both directions and restores focus on Escape", () => {
    render(<AccountScreen viewModel={viewModel} />);
    const trigger = screen.getByRole("button", { name: "개인 정보 수정" });
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("heading", { name: "개인 정보 수정" })).toHaveFocus();
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "닫기" });
    const save = screen.getByRole("button", { name: "개인 정보 저장" });
    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
