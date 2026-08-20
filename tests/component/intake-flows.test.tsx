import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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
import { RecordFormShell, recordDraftKey, writeRecordDraft } from "@/modules/records/ui/record-form-shell";
import { formatRecordWallTimeInput } from "@/shared/time/zoned-date-time";

describe("intake flows", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/record");
    router.push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("associates every validation message for one field through one unique error container", async () => {
    const view = render(
      <RecordFormShell
        pathname="/record/batch"
        action={async () => ({
          status: "error",
          values: {},
          fieldErrors: { items: ["한 개 이상 선택해 주세요.", "삭제할 수 없는 기록이 포함되어 있습니다."] },
        })}
      >
        {() => <input name="items" defaultValue="[]" />}
      </RecordFormShell>,
    );

    fireEvent.submit(view.container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText("한 개 이상 선택해 주세요.")).toBeVisible());
    const field = view.container.querySelector<HTMLInputElement>('input[name="items"]')!;
    const errorId = field.getAttribute("aria-describedby")!;
    const linkedErrors = view.container.querySelectorAll(`[id="${errorId}"]`);

    expect(linkedErrors).toHaveLength(1);
    expect(linkedErrors[0]).toHaveTextContent("한 개 이상 선택해 주세요.");
    expect(linkedErrors[0]).toHaveTextContent("삭제할 수 없는 기록이 포함되어 있습니다.");
  });

  it("restores a saved draft once when initial values are omitted", async () => {
    const pathname = "/record/stable-defaults";
    writeRecordDraft(pathname, {
      step: "confirm",
      values: { title: "저장된 일정" },
      idempotencyKey: "stable-draft-id",
      expiresAt: Date.now() + 60_000,
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    render(
      <RecordFormShell
        pathname={pathname}
        action={async () => ({ status: "success", recordId: "stable-defaults-record" })}
      >
        {({ values, setValue }) => (
          <label>
            제목
            <input name="title" value={values.title ?? ""} onChange={(event) => setValue("title", event.target.value)} />
          </label>
        )}
      </RecordFormShell>,
    );

    await waitFor(() => expect(screen.getByLabelText("제목")).toHaveValue("저장된 일정"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const draftReads = getItem.mock.calls.filter(([key]) => key === recordDraftKey(pathname));
    expect(draftReads).toHaveLength(1);
  });

  it("uses the stored non-UTC timezone for datetime and local-date defaults near midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T15:30:00.000Z"));

    const caffeine = render(<CaffeineFlow timezone="Asia/Seoul" step="menu-and-amount" />);
    expect(screen.getByLabelText("마신 시각")).toHaveValue("2026-08-21T00:30");
    caffeine.unmount();

    const alcohol = render(<AlcoholFlow timezone="Asia/Seoul" step="amount" />);
    expect(screen.getByLabelText("마신 시각")).toHaveValue("2026-08-21T00:30");
    alcohol.unmount();

    const meal = render(<MealHealthFlow timezone="Asia/Seoul" step="meal" />);
    expect(screen.getByLabelText("식사 시각")).toHaveValue("2026-08-21T00:30");
    meal.unmount();

    const wellness = render(<MealHealthFlow timezone="Asia/Seoul" step="exercise-and-wellness" />);
    expect(screen.getByLabelText("컨디션 날짜")).toHaveValue("2026-08-21");
    wellness.unmount();

    render(<SleepPhoneFlow timezone="Asia/Seoul" step="sleep" />);
    expect(screen.getByLabelText("수면 시작")).toHaveValue("2026-08-21T00:30");
  });

  it("keeps a fall-back edit on the same repeated-time occurrence in its submit payload", () => {
    const editTime = formatRecordWallTimeInput(
      new Date("2026-11-01T06:30:00.000Z"),
      "America/New_York",
    );
    const view = render(
      <CaffeineFlow
        timezone="America/New_York"
        step="menu-and-amount"
        initialValues={{
          recordId: "caffeine-1",
          brand: "테스트",
          product: "커피",
          caffeineMg: "100",
          consumedAt: editTime.value,
          consumedAtDisambiguation: editTime.disambiguation,
        }}
      />,
    );

    expect(screen.getByLabelText("마신 시각")).toHaveValue("2026-11-01T01:30");
    expect(screen.getByLabelText("반복 시각 선택")).toHaveValue("later");
    fireEvent.click(screen.getByRole("button", { name: "수치 확인하기" }));

    const payload = view.container.querySelector<HTMLInputElement>('input[name="items"]');
    expect(JSON.parse(payload?.value ?? "[]")[0]).toMatchObject({
      recordId: "caffeine-1",
      consumedAt: "2026-11-01T01:30",
      consumedAtDisambiguation: "later",
    });
  });

  it("submits untouched fall-back defaults with their derived occurrence on every intake surface", () => {
    const cases = [
      {
        renderFlow: () => render(<CaffeineFlow timezone="America/New_York" step="confirm" />),
        submitLabel: "카페인 저장",
        expected: [{
          consumedAt: "2026-11-01T01:30",
          consumedAtDisambiguation: "later",
        }],
      },
      {
        renderFlow: () => render(<AlcoholFlow timezone="America/New_York" step="confirm" />),
        submitLabel: "음주 저장",
        expected: [{
          consumedAt: "2026-11-01T01:30",
          consumedAtDisambiguation: "later",
        }],
      },
      {
        renderFlow: () => render(<MealHealthFlow timezone="America/New_York" step="confirm" />),
        submitLabel: "식사/운동/컨디션 저장",
        expected: [
          { eatenAt: "2026-11-01T01:30", eatenAtDisambiguation: "later" },
          {
            startedAt: "2026-11-01T01:30",
            startedAtDisambiguation: "later",
            endedAt: "2026-11-01T01:30",
            endedAtDisambiguation: "later",
          },
        ],
      },
      {
        renderFlow: () => render(<SleepPhoneFlow timezone="America/New_York" step="confirm" />),
        submitLabel: "수면/휴대폰 저장",
        expected: [
          {
            startedAt: "2026-11-01T01:30",
            startedAtDisambiguation: "later",
            endedAt: "2026-11-01T01:30",
            endedAtDisambiguation: "later",
          },
          { lastUseAt: "2026-11-01T01:30", lastUseAtDisambiguation: "later" },
        ],
      },
    ];

    for (const testCase of cases) {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-01T06:30:00.000Z"));
      const view = testCase.renderFlow();
      vi.useRealTimers();

      const submissions: FormData[] = [];
      const form = view.container.querySelector("form");
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        submissions.push(new FormData(event.currentTarget as HTMLFormElement));
      }, { capture: true, once: true });

      fireEvent.click(screen.getByRole("button", { name: testCase.submitLabel }));

      const submitted = submissions[0];
      expect(submitted).not.toBeNull();
      const items = JSON.parse(String(submitted?.get("items") ?? "[]")) as Array<Record<string, unknown>>;
      testCase.expected.forEach((expected, index) => {
        expect(items[index]).toMatchObject(expected);
      });
      view.unmount();
    }
  });

  it("renders caffeine brand step", () => {
    render(<CaffeineFlow timezone="Asia/Seoul" step="brand" />);

    expect(screen.getByRole("heading", { name: "어디서 마셨나요?" })).toBeVisible();
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

  it("writes Figma quick selections into the real form fields", () => {
    const caffeine = render(<CaffeineFlow timezone="Asia/Seoul" step="brand" />);
    fireEvent.click(screen.getByRole("button", { name: /스타벅스/ }));
    expect(screen.getByLabelText("브랜드")).toHaveValue("스타벅스");
    caffeine.unmount();

    render(<AlcoholFlow timezone="Asia/Seoul" step="type" />);
    fireEvent.click(screen.getByRole("button", { name: /소주/ }));
    expect(screen.getByLabelText("음주 종류")).toHaveValue("소주");
  });

  it("describes phone data as manual rather than claiming an unavailable sync", () => {
    render(<SleepPhoneFlow timezone="Asia/Seoul" step="phone" />);

    expect(screen.getByText("직접 입력")).toBeVisible();
    expect(screen.getByText("기기 자동 연동 없이 입력한 값이 저장됩니다.")).toBeVisible();
    expect(screen.queryByText("실시간 연동")).not.toBeInTheDocument();
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

  it("keeps focused meal and sleep cards scoped to the records their forms display", () => {
    const meal = render(<MealHealthFlow timezone="Asia/Seoul" step="confirm" focus="meal" />);
    expect(screen.getByRole("button", { name: "식사 저장" })).toBeVisible();
    expect(JSON.parse(meal.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]"))
      .toEqual([expect.objectContaining({ type: "meal" })]);
    meal.unmount();

    const sleep = render(<SleepPhoneFlow timezone="Asia/Seoul" step="confirm" focus="sleep" />);
    expect(screen.getByRole("button", { name: "수면 저장" })).toBeVisible();
    expect(JSON.parse(sleep.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]"))
      .toEqual([expect.objectContaining({ type: "sleep" })]);
    sleep.unmount();

    const phone = render(<SleepPhoneFlow timezone="Asia/Seoul" step="confirm" focus="phone" />);
    expect(screen.getByRole("button", { name: "휴대폰 저장" })).toBeVisible();
    expect(JSON.parse(phone.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]"))
      .toEqual([expect.objectContaining({ type: "phone-usage" })]);
  });

  it("advances caffeine without a query string and restores its pathname draft on back and refresh", async () => {
    window.history.replaceState({}, "", "/record/caffeine");
    const view = render(<CaffeineFlow timezone="Asia/Seoul" />);

    fireEvent.change(screen.getByLabelText("브랜드"), { target: { value: "루이비스" } });
    fireEvent.click(screen.getByRole("button", { name: "메뉴 선택하기" }));

    expect(window.location.search).toBe("");
    expect(screen.getByLabelText("제품명")).toBeVisible();
    expect(JSON.parse(window.sessionStorage.getItem("record-draft:/record/caffeine") ?? "null"))
      .toMatchObject({ schemaVersion: 1, draft: { step: "menu-and-amount", values: { brand: "루이비스" } } });

    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(screen.getByLabelText("브랜드")).toHaveValue("루이비스");
    fireEvent.click(screen.getByRole("button", { name: "메뉴 선택하기" }));
    view.unmount();

    render(<CaffeineFlow timezone="Asia/Seoul" />);
    expect(await screen.findByLabelText("제품명")).toBeVisible();
    expect(window.location.search).toBe("");
  });

  it.each([
    {
      pathname: "/record/alcohol",
      renderFlow: () => render(<AlcoholFlow timezone="Asia/Seoul" />),
      label: "음주 종류",
      value: "맥주",
      nextLabel: "잔 수",
      storedStep: "amount",
      nextButton: "양 입력하기",
    },
    {
      pathname: "/record/meal-health",
      renderFlow: () => render(<MealHealthFlow timezone="Asia/Seoul" />),
      label: "메모",
      value: "점심",
      nextLabel: "운동",
      storedStep: "exercise-and-wellness",
      nextButton: "운동 · 컨디션 입력",
    },
    {
      pathname: "/record/sleep-phone",
      renderFlow: () => render(<SleepPhoneFlow timezone="Asia/Seoul" />),
      label: "아침 피로(1-5)",
      value: "5",
      nextLabel: "마지막 휴대폰 사용",
      storedStep: "phone",
      nextButton: "오늘 휴대폰 기록",
    },
  ])("keeps $pathname health values out of URL history", ({ pathname, renderFlow, label, value, nextLabel, storedStep, nextButton }) => {
    window.history.replaceState({}, "", pathname);
    renderFlow();

    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: nextButton }));

    expect(screen.getByLabelText(nextLabel)).toBeVisible();
    expect(window.location.search).toBe("");
    expect(window.location.href).not.toContain(encodeURIComponent(value));
    expect(JSON.parse(window.sessionStorage.getItem(`record-draft:${pathname}`) ?? "null"))
      .toMatchObject({ schemaVersion: 1, draft: { step: storedStep } });
  });
});
