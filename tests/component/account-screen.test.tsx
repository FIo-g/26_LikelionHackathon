import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  updateSleepGoal: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("@/app/(app)/account/actions", () => ({
  updateProfileAction: actions.updateProfile,
  updateSleepGoalAction: actions.updateSleepGoal,
  deleteUserAccountAction: actions.deleteAccount,
  deleteAccountActionIdle: { status: "idle", error: null },
}));
import { AccountScreen } from "@/modules/account/ui/account-screen";

afterEach(() => {
  actions.updateProfile.mockReset();
  actions.updateSleepGoal.mockReset();
  actions.deleteAccount.mockReset();
});

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
  it("uses unique field ids across desktop and mobile forms", () => {
    render(<AccountScreen viewModel={viewModel} />);
    const ids = Array.from(document.querySelectorAll("input[id], select[id]"), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("associates a profile field error and politely announces the submit result", async () => {
    actions.updateProfile.mockResolvedValue({ status: "error", values: { nickname: "Alice", timezone: "Asia/Seoul" }, fieldErrors: { nickname: ["필수 입력입니다."] } });
    render(<AccountScreen viewModel={viewModel} />);

    await userEvent.click(screen.getAllByRole("button", { name: "개인 정보 저장" })[0]);
    const input = screen.getAllByLabelText("닉네임")[0];
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("필수 입력입니다.");
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("필수 입력입니다.");
  });

  it("truthfully distinguishes direct input from unavailable automatic connections", () => {
    render(<AccountScreen viewModel={viewModel} />);

    expect(screen.getAllByText("직접 입력 사용 중")[0]).toBeVisible();
    expect(screen.getAllByText("웨어러블 연동 준비 중")[0]).toBeVisible();
    expect(screen.getAllByText("휴대폰 연동 준비 중")[0]).toBeVisible();
    expect(screen.getAllByText("캘린더 연동 준비 중")[0]).toBeVisible();
    expect(screen.queryByText("자동 입력 중")).not.toBeInTheDocument();
    expect(screen.getAllByText("수면")[0]).toBeVisible();
    expect(screen.getAllByText("웰니스")[0]).toBeVisible();
  });

  it("traps Tab in both directions and restores focus on Escape", () => {
    render(<AccountScreen viewModel={viewModel} />);
    const trigger = screen.getByRole("button", { name: "개인 정보 수정" });
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("heading", { name: "개인 정보 수정" })).toHaveFocus();
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "닫기" });
    const save = within(dialog).getByRole("button", { name: "개인 정보 저장" });
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
