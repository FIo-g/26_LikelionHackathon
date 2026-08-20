import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { RecordCategoryCard } from "@/modules/records/ui/record-category-card";

describe("record category card", () => {
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
});
