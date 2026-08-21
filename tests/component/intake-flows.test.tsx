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
import { createIdempotencyKey, RecordFormShell, recordDraftKey, writeRecordDraft } from "@/modules/records/ui/record-form-shell";
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

  it("starts a fresh create flow instead of restoring an edit draft", async () => {
    const pathname = "/record/caffeine";
    writeRecordDraft(pathname, {
      step: "confirm",
      values: { recordId: "existing-record", title: "수정 중인 기록" },
      idempotencyKey: "stable-draft-id",
      expiresAt: Date.now() + 60_000,
    });
    window.history.replaceState({}, "", "/record/caffeine?mode=create");
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    render(
      <RecordFormShell
        pathname={pathname}
        freshCreate
        initialValues={{ title: "새 기록" }}
        action={async () => ({ status: "success", recordId: "new-record" })}
      >
        {({ values, setValue }) => (
          <label>
            제목
            <input name="title" value={values.title ?? ""} onChange={(event) => setValue("title", event.target.value)} />
          </label>
        )}
      </RecordFormShell>,
    );

    await waitFor(() => expect(screen.getByLabelText("제목")).toHaveValue("새 기록"));
    expect(getItem.mock.calls.filter(([key]) => key === recordDraftKey(pathname))).toHaveLength(1);
    expect(window.sessionStorage.getItem(recordDraftKey(pathname))).toBeNull();
  });

  it("keeps an unfinished create draft and idempotency key through a fresh-create remount", async () => {
    const pathname = "/record/caffeine";
    const idempotencyKey = "b4e9a0d2-c051-4f97-a1fc-253cb75bc39c";
    writeRecordDraft(pathname, {
      step: "brand",
      values: { title: "저장 전 카페" },
      idempotencyKey,
      expiresAt: Date.now() + 60_000,
    });
    window.history.replaceState({}, "", "/record/caffeine?mode=create");

    const renderFreshCreate = () => render(
      <RecordFormShell
        pathname={pathname}
        freshCreate
        initialValues={{ title: "새 기록" }}
        action={async () => ({ status: "success", recordId: "new-record" })}
      >
        {({ values, idempotencyKey: currentIdempotencyKey, setValue }) => (
          <>
            <input type="hidden" name="idempotencyKey" value={currentIdempotencyKey} readOnly />
            <label>
              제목
              <input name="title" value={values.title ?? ""} onChange={(event) => setValue("title", event.target.value)} />
            </label>
          </>
        )}
      </RecordFormShell>
    );

    const firstView = renderFreshCreate();
    await waitFor(() => expect(screen.getByLabelText("제목")).toHaveValue("저장 전 카페"));
    expect(firstView.container.querySelector<HTMLInputElement>('input[type="hidden"]')).toHaveValue(idempotencyKey);
    firstView.unmount();

    const reloadedView = renderFreshCreate();
    await waitFor(() => expect(screen.getByLabelText("제목")).toHaveValue("저장 전 카페"));
    expect(reloadedView.container.querySelector<HTMLInputElement>('input[type="hidden"]')).toHaveValue(idempotencyKey);
    expect(window.sessionStorage.getItem(recordDraftKey(pathname))).toContain(idempotencyKey);
  });

  it("restores an exercise and wellness edit draft only outside fresh-create mode", async () => {
    const pathname = "/record/meal-health";
    writeRecordDraft(pathname, {
      step: "exercise-and-wellness",
      values: {
        exerciseRecordId: "exercise-existing",
        exerciseType: "조깅",
        exerciseIntensity: "high",
        exerciseStartedAt: "2026-08-20T09:00",
        exerciseEndedAt: "2026-08-20T09:30",
        exerciseAverageHeartRate: "130",
        fatigueLevel: "2",
        stressLevel: "3",
        wellnessLocalDate: "2026-08-20",
        wellnessRecordId: "wellness-existing",
      },
      expiresAt: Date.now() + 60_000,
    }, "exercise");
    window.history.replaceState({}, "", "/record/meal-health?step=exercise-and-wellness&focus=exercise");

    const view = render(<MealHealthFlow timezone="Asia/Seoul" step="exercise-and-wellness" focus="exercise" />);

    await waitFor(() => expect(screen.getByLabelText("운동")).toHaveValue("조깅"));
    fireEvent.click(screen.getByRole("button", { name: "기록 확인" }));

    expect(JSON.parse(view.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]"))
      .toEqual([
        expect.objectContaining({ recordId: "exercise-existing", type: "exercise" }),
        expect.objectContaining({ recordId: "wellness-existing", type: "wellness" }),
      ]);
  });

  it("isolates focused create drafts so exercise cannot become a meal and sleep cannot become phone usage", async () => {
    writeRecordDraft("/record/meal-health", {
      step: "exercise-and-wellness",
      values: {
        exerciseRecordId: "exercise-existing",
        exerciseType: "조깅",
        wellnessRecordId: "wellness-existing",
      },
      expiresAt: Date.now() + 60_000,
    }, "exercise");
    window.history.replaceState({}, "", "/record/meal-health?step=confirm&focus=meal&mode=create");

    const meal = render(
      <MealHealthFlow timezone="Asia/Seoul" step="confirm" focus="meal" freshCreate />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "식사 저장" })).toBeVisible());
    expect(JSON.parse(meal.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]"))
      .toEqual([expect.objectContaining({ type: "meal" })]);
    expect(JSON.parse(meal.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]")[0])
      .not.toHaveProperty("recordId");
    expect(window.sessionStorage.getItem(recordDraftKey("/record/meal-health", "exercise"))).toContain("exercise-existing");
    meal.unmount();

    writeRecordDraft("/record/sleep-phone", {
      step: "sleep",
      values: {
        sleepRecordId: "sleep-existing",
        sleepStartedAt: "2026-08-20T23:00",
        sleepEndedAt: "2026-08-21T07:00",
      },
      expiresAt: Date.now() + 60_000,
    }, "sleep");
    window.history.replaceState({}, "", "/record/sleep-phone?step=confirm&focus=phone&mode=create");

    const phone = render(
      <SleepPhoneFlow timezone="Asia/Seoul" step="confirm" focus="phone" freshCreate />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "휴대폰 저장" })).toBeVisible());
    expect(JSON.parse(phone.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]"))
      .toEqual([expect.objectContaining({ type: "phone-usage" })]);
    expect(JSON.parse(phone.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]")[0])
      .not.toHaveProperty("recordId");
    expect(window.sessionStorage.getItem(recordDraftKey("/record/sleep-phone", "sleep"))).toContain("sleep-existing");
  });

  it("clears a legacy pathname-only edit draft only for an explicit fresh create", async () => {
    const pathname = "/record/meal-health";
    writeRecordDraft(pathname, {
      step: "meal",
      values: { mealRecordId: "legacy-meal", mealNotes: "기존 편집" },
      expiresAt: Date.now() + 60_000,
    });

    const normalView = render(<MealHealthFlow timezone="Asia/Seoul" step="meal" focus="meal" />);
    await waitFor(() => expect(screen.getByLabelText("메모")).toHaveValue(""));
    expect(window.sessionStorage.getItem(recordDraftKey(pathname))).toContain("legacy-meal");
    normalView.unmount();

    const freshView = render(<MealHealthFlow timezone="Asia/Seoul" step="confirm" focus="meal" freshCreate />);
    await waitFor(() => expect(screen.getByRole("button", { name: "식사 저장" })).toBeVisible());
    expect(window.sessionStorage.getItem(recordDraftKey(pathname))).toBeNull();
    expect(JSON.parse(freshView.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]")[0])
      .not.toHaveProperty("recordId");
  });

  it("generates a server-valid UUID idempotency key without crypto.randomUUID", () => {
    vi.stubGlobal("crypto", {});
    try {
      expect(createIdempotencyKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    } finally {
      vi.unstubAllGlobals();
    }
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
    expect(screen.getByLabelText("마신 시각 반복 시각 선택")).toHaveValue("later");
    fireEvent.click(screen.getByRole("button", { name: "수치 확인하기" }));

    const payload = view.container.querySelector<HTMLInputElement>('input[name="items"]');
    expect(JSON.parse(payload?.value ?? "[]")[0]).toMatchObject({
      recordId: "caffeine-1",
      consumedAt: "2026-11-01T01:30",
      consumedAtDisambiguation: "later",
    });
  });

  it("hides repeated-time choices for every normal record time in Asia/Seoul", () => {
    const cases = [
      () => render(<CaffeineFlow timezone="Asia/Seoul" step="menu-and-amount" />),
      () => render(<AlcoholFlow timezone="Asia/Seoul" step="amount" />),
      () => render(<MealHealthFlow timezone="Asia/Seoul" step="meal" />),
      () => render(<MealHealthFlow timezone="Asia/Seoul" step="exercise-and-wellness" />),
      () => render(<SleepPhoneFlow timezone="Asia/Seoul" step="sleep" />),
      () => render(<SleepPhoneFlow timezone="Asia/Seoul" step="phone" />),
    ];

    for (const renderFlow of cases) {
      const view = renderFlow();
      expect(view.container.querySelectorAll('select[name$="Disambiguation"]')).toHaveLength(0);
      view.unmount();
    }
  });

  it("shows a repeated-time choice only after an ambiguous wall time is selected", () => {
    const repeatedTime = "2026-11-01T01:30";
    const newYork = render(
      <SleepPhoneFlow
        timezone="America/New_York"
        step="sleep"
        focus="sleep"
        initialValues={{
          sleepStartedAt: "2026-11-01T00:30",
          sleepEndedAt: "2026-11-01T02:30",
          morningFatigue: "3",
        }}
      />,
    );

    expect(screen.queryByLabelText("수면 시작 반복 시각 선택")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("수면 시작"), { target: { value: repeatedTime } });
    expect(screen.getByLabelText("수면 시작 반복 시각 선택")).toHaveValue("earlier");
    fireEvent.click(screen.getByRole("button", { name: "기록 확인" }));
    const items = JSON.parse(newYork.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]");
    expect(items).toEqual([expect.objectContaining({
      startedAt: repeatedTime,
      startedAtDisambiguation: "earlier",
    })]);
  });

  it("gives each simultaneous repeated-time choice a field-specific accessible label", () => {
    render(
      <MealHealthFlow
        timezone="America/New_York"
        step="exercise-and-wellness"
        focus="exercise"
        initialValues={{
          exerciseStartedAt: "2026-11-01T01:30",
          exerciseEndedAt: "2026-11-01T01:30",
        }}
      />,
    );

    expect(screen.getByLabelText("운동 시작 반복 시각 선택")).toHaveValue("earlier");
    expect(screen.getByLabelText("운동 종료 반복 시각 선택")).toHaveValue("earlier");
  });

  it("opens or focuses every native record date and time field from its full visual label", () => {
    const original = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "showPicker");
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
      configurable: true,
      value: showPicker,
    });

    const cases = [
      {
        renderFlow: () => render(<CaffeineFlow timezone="Asia/Seoul" step="menu-and-amount" />),
        label: "마신 시각",
      },
      {
        renderFlow: () => render(<AlcoholFlow timezone="Asia/Seoul" step="amount" />),
        label: "마신 시각",
      },
      {
        renderFlow: () => render(<MealHealthFlow timezone="Asia/Seoul" step="meal" />),
        label: "식사 시각",
      },
      {
        renderFlow: () => render(<MealHealthFlow timezone="Asia/Seoul" step="exercise-and-wellness" />),
        label: "운동 시작",
      },
      {
        renderFlow: () => render(<MealHealthFlow timezone="Asia/Seoul" step="exercise-and-wellness" />),
        label: "운동 종료",
      },
      {
        renderFlow: () => render(<MealHealthFlow timezone="Asia/Seoul" step="exercise-and-wellness" />),
        label: "컨디션 날짜",
      },
      {
        renderFlow: () => render(<SleepPhoneFlow timezone="Asia/Seoul" step="sleep" />),
        label: "수면 시작",
      },
      {
        renderFlow: () => render(<SleepPhoneFlow timezone="Asia/Seoul" step="phone" />),
        label: "마지막 휴대폰 사용",
      },
    ];

    try {
      for (const testCase of cases) {
        const view = testCase.renderFlow();
        const input = screen.getByLabelText(testCase.label) as HTMLInputElement;
        fireEvent.pointerDown(input.closest("label")!);

        expect(input).toHaveFocus();
        view.unmount();
      }

      expect(showPicker).toHaveBeenCalledTimes(cases.length);
    } finally {
      if (original) {
        Object.defineProperty(HTMLInputElement.prototype, "showPicker", original);
      } else {
        Reflect.deleteProperty(HTMLInputElement.prototype, "showPicker");
      }
    }
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
    const view = render(
      <AlcoholFlow
        timezone="Asia/Seoul"
        step="amount"
        initialValues={{ alcoholType: "맥주" }}
      />,
    );

    expect(screen.getByLabelText("마신 양(기록 단위)")).toBeVisible();
    expect(screen.getByLabelText("마신 양 기준")).toHaveValue("");
    expect(screen.getByText("마신 양 기준을 선택하면 숫자와 함께 저장돼요. 부피나 도수는 자동으로 환산하지 않아요.")).toBeVisible();
    expect(screen.getByRole("button", { name: "1 단위" })).toBeVisible();
    expect(screen.queryByText(/1잔/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기록 확인" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("마신 양 기준"), { target: { value: "can" } });
    expect(screen.getByRole("button", { name: "1 캔" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "1 캔" }));
    fireEvent.click(screen.getByRole("button", { name: "기록 확인" }));

    expect(JSON.parse(view.container.querySelector<HTMLInputElement>('input[name="items"]')?.value ?? "[]"))
      .toEqual([expect.objectContaining({ alcoholType: "맥주", servings: "1", measurementUnit: "can", type: "alcohol" })]);

    view.unmount();
    render(
      <AlcoholFlow
        timezone="Asia/Seoul"
        step="amount"
        initialValues={{ recordId: "legacy-alcohol", alcoholType: "맥주", servings: "1" }}
      />,
    );
    expect(screen.getByText("기존 기록에는 마신 양 기준이 없어요. 수정해서 선택한 기준을 함께 저장해주세요.")).toBeVisible();
    expect(screen.getByRole("button", { name: "기록 확인" })).toBeDisabled();
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
      draftScope: undefined,
      renderFlow: () => render(<AlcoholFlow timezone="Asia/Seoul" />),
      label: "음주 종류",
      value: "맥주",
      nextLabel: "마신 양(기록 단위)",
      storedStep: "amount",
      nextButton: "양 입력하기",
    },
    {
      pathname: "/record/meal-health",
      draftScope: "all",
      renderFlow: () => render(<MealHealthFlow timezone="Asia/Seoul" />),
      label: "메모",
      value: "점심",
      nextLabel: "운동",
      storedStep: "exercise-and-wellness",
      nextButton: "운동 · 컨디션 입력",
    },
    {
      pathname: "/record/sleep-phone",
      draftScope: "all",
      renderFlow: () => render(<SleepPhoneFlow timezone="Asia/Seoul" />),
      label: "아침 피로(1-5)",
      value: "5",
      nextLabel: "마지막 휴대폰 사용",
      storedStep: "phone",
      nextButton: "오늘 휴대폰 기록",
    },
  ])("keeps $pathname health values out of URL history", ({ pathname, draftScope, renderFlow, label, value, nextLabel, storedStep, nextButton }) => {
    window.history.replaceState({}, "", pathname);
    renderFlow();

    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: nextButton }));

    expect(screen.getByLabelText(nextLabel)).toBeVisible();
    expect(window.location.search).toBe("");
    expect(window.location.href).not.toContain(encodeURIComponent(value));
    expect(JSON.parse(window.sessionStorage.getItem(recordDraftKey(pathname, draftScope)) ?? "null"))
      .toMatchObject({ schemaVersion: 1, draft: { step: storedStep } });
  });
});
