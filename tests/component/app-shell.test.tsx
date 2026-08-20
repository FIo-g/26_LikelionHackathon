import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/shared/ui/app-shell/app-shell";
import { ScheduleConfirmationDialog } from "@/modules/planner/ui/schedule-confirmation-dialog";

describe("AppShell", () => {
  it("renders one content tree and Account in desktop and mobile navigation", () => {
    render(<AppShell><p>protected content</p></AppShell>);

    expect(screen.getAllByRole("link", { name: "Account" })).toHaveLength(2);
    expect(screen.getAllByText("protected content")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "데스크톱 주요 메뉴" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "모바일 주요 메뉴" })).toBeInTheDocument();
  });

  it("closes schedule confirmation with Escape and restores opener focus", () => {
    const cancel = vi.fn();
    const { rerender } = render(<button type="button">계획에 반영</button>);
    const opener = screen.getByRole("button", { name: "계획에 반영" });
    opener.focus();
    rerender(<><button type="button">계획에 반영</button><ScheduleConfirmationDialog title="확인" changes={[]} timezone="Asia/Seoul" confirmLabel="반영" onCancel={cancel} onConfirm={vi.fn()} /></>);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
