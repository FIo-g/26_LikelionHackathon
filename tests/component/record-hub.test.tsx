import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { RecordCategoryCard } from "@/modules/records/ui/record-category-card";

describe("record category card", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/record");
  });

  it.each([
    ["empty", "추가"],
    ["completed", "수정"],
  ] as const)("maps %s presence to %s action", (presence, label) => {
    render(
      <RecordCategoryCard
        category="카페인"
        presence={presence}
        inputMode="manual"
        summary="마지막: 2026-08-20"
        href="/record/caffeine"
      />,
    );

    expect(screen.getByRole("link", { name: label })).toBeVisible();
  });

  it("never presents phone category as synchronized", () => {
    render(
      <RecordCategoryCard
        category="수면/휴대폰"
        presence="completed"
        inputMode="manual"
        summary="마지막: 2026-08-20"
        href="/record/sleep-phone"
      />,
    );

    expect(screen.getByText("직접 입력 사용 중")).toBeVisible();
    expect(screen.queryByText("연동됨")).not.toBeInTheDocument();
  });

  it("exposes add, edit, and delete controls without putting record data in the href", () => {
    render(
      <RecordCategoryCard
        category="카페인"
        presence="completed"
        inputMode="manual"
        summary="마지막: 2026-08-20"
        href="/record/caffeine"
      />,
    );

    expect(screen.getByRole("link", { name: "추가" })).toHaveAttribute("href", "/record/caffeine");
    expect(screen.getByRole("link", { name: "수정" })).toHaveAttribute("href", "/record/caffeine");
    expect(screen.getByRole("button", { name: "삭제" })).toBeVisible();
  });

  it("stores edit ids and health values only in the pathname-scoped session draft", () => {
    render(
      <RecordCategoryCard
        category="카페인"
        presence="completed"
        inputMode="manual"
        summary="마지막: 2026-08-20"
        href="/record/caffeine"
        records={[{ recordId: "record-secret", recordType: "caffeine" }]}
        editDraft={{
          step: "brand",
          values: {
            recordId: "record-secret",
            caffeineMg: "125",
            consumedAt: "2026-08-20T08:30",
          },
        }}
      />,
    );

    const editLink = screen.getByRole("link", { name: "수정" });
    editLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(editLink);

    expect(window.location.search).toBe("");
    expect(window.location.href).not.toContain("record-secret");
    expect(window.location.href).not.toContain("125");
    expect(JSON.parse(window.sessionStorage.getItem("record-draft:/record/caffeine") ?? "null"))
      .toMatchObject({
        schemaVersion: 1,
        draft: {
          step: "brand",
          values: {
            recordId: "record-secret",
            caffeineMg: "125",
            consumedAt: "2026-08-20T08:30",
          },
        },
      });
  });

  it("keeps the draft pathname-scoped when a focused card uses safe query parameters", () => {
    render(
      <RecordCategoryCard
        category="식사"
        presence="completed"
        inputMode="manual"
        summary="마지막: 2026-08-20"
        href="/record/meal-health?step=meal&focus=meal"
        records={[{ recordId: "meal-secret", recordType: "meal" }]}
        editDraft={{
          step: "meal",
          values: { mealRecordId: "meal-secret", mealNotes: "개인 메모" },
        }}
      />,
    );

    const editLink = screen.getByRole("link", { name: "수정" });
    editLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(editLink);

    expect(window.sessionStorage.getItem("record-draft:/record/meal-health")).not.toBeNull();
    expect(window.sessionStorage.getItem("record-draft:/record/meal-health?step=meal&focus=meal")).toBeNull();
    expect(window.location.href).not.toContain("meal-secret");
    expect(window.location.href).not.toContain(encodeURIComponent("개인 메모"));
  });
});
