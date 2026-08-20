"use client";

import { useMemo } from "react";
import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import { saveRecordBatchAction } from "@/app/(app)/record/actions";

type SleepPhoneStep = "sleep" | "phone" | "confirm";

export const INTAKE_STEPS = {
  sleepPhone: ["sleep", "phone", "confirm"] as const,
} as const;

type RawValue = Readonly<{
  sleepStartedAt?: string;
  sleepEndedAt?: string;
  morningFatigue?: string;
  sleepRecordId?: string;
  lastUseAt?: string;
  durationMinutes?: string;
  phoneRecordId?: string;
}>;

type SleepPhoneFlowProps = Readonly<{
  timezone: string;
  step?: SleepPhoneStep | string;
  successRedirectPath?: string;
  initialValues?: RawValue;
}>;

const defaultNow = (): string => new Date().toISOString().slice(0, 16);
const safeText = (value: string | undefined): string => value?.trim() ?? "";

const normalizeStep = (step?: SleepPhoneStep | string): SleepPhoneStep => {
  if (step === "phone" || step === "confirm") {
    return step;
  }

  return "sleep";
};

const toPayloadItems = (values: Record<string, string>): string => {
  const items = [
    {
      clientKey: "sleep",
      ...(safeText(values.sleepRecordId) ? { recordId: values.sleepRecordId } : {}),
      type: "sleep" as const,
      startedAt: safeText(values.sleepStartedAt) || defaultNow(),
      endedAt: safeText(values.sleepEndedAt) || defaultNow(),
      morningFatigue: Number(safeText(values.morningFatigue) || "1"),
      timezone: values.timezone,
    },
    {
      clientKey: "phone",
      ...(safeText(values.phoneRecordId) ? { recordId: values.phoneRecordId } : {}),
      type: "phone-usage" as const,
      lastUseAt: safeText(values.lastUseAt) || defaultNow(),
      durationMinutes: Number(safeText(values.durationMinutes) || "0"),
      timezone: values.timezone,
    },
  ];

  return JSON.stringify(items);
};

const buildSummary = (values: Record<string, string>) => [
  { label: "수면 시작", value: safeText(values.sleepStartedAt) || "-" },
  { label: "수면 종료", value: safeText(values.sleepEndedAt) || "-" },
  { label: "아침 피로", value: safeText(values.morningFatigue) || "-" },
  { label: "마지막 휴대폰 사용", value: safeText(values.lastUseAt) || "-" },
  { label: "휴대폰 사용 시간", value: `${safeText(values.durationMinutes) || "0"} 분` },
];

export const SleepPhoneFlow = ({
  timezone,
  step: rawStep,
  successRedirectPath = "/record",
  initialValues = {},
}: SleepPhoneFlowProps) => {
  const step = normalizeStep(rawStep);
  const values = {
    timezone,
    sleepStartedAt: safeText(initialValues.sleepStartedAt) || defaultNow(),
    sleepEndedAt: safeText(initialValues.sleepEndedAt) || defaultNow(),
    morningFatigue: safeText(initialValues.morningFatigue) || "1",
    sleepRecordId: safeText(initialValues.sleepRecordId),
    lastUseAt: safeText(initialValues.lastUseAt) || defaultNow(),
    durationMinutes: safeText(initialValues.durationMinutes) || "0",
    phoneRecordId: safeText(initialValues.phoneRecordId),
  };

  if (step === "sleep") {
    return (
      <main>
        <h1>수면/휴대폰</h1>
        <p>1/3 단계</p>
        <form action="/record/sleep-phone" method="get">
          <input type="hidden" name="step" value="phone" />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="sleepRecordId" value={values.sleepRecordId} />

          <label>
            수면 시작
            <input type="datetime-local" name="sleepStartedAt" defaultValue={values.sleepStartedAt} required />
          </label>
          <label>
            수면 종료
            <input type="datetime-local" name="sleepEndedAt" defaultValue={values.sleepEndedAt} required />
          </label>
          <label>
            아침 피로(1-5)
            <input type="number" min="1" max="5" name="morningFatigue" defaultValue={values.morningFatigue} required />
          </label>
          <button type="submit">다음</button>
        </form>
      </main>
    );
  }

  if (step === "phone") {
    return (
      <main>
        <h1>수면/휴대폰</h1>
        <p>2/3 단계</p>
        <form action="/record/sleep-phone" method="get">
          <input type="hidden" name="step" value="confirm" />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="sleepStartedAt" value={values.sleepStartedAt} />
          <input type="hidden" name="sleepEndedAt" value={values.sleepEndedAt} />
          <input type="hidden" name="morningFatigue" value={values.morningFatigue} />
          <input type="hidden" name="sleepRecordId" value={values.sleepRecordId} />

          <label>
            마지막 휴대폰 사용
            <input type="datetime-local" name="lastUseAt" defaultValue={values.lastUseAt} required />
          </label>
          <label>
            사용 시간(분)
            <input type="number" min="0" max="1440" name="durationMinutes" defaultValue={values.durationMinutes} required />
          </label>
          <input type="hidden" name="phoneRecordId" value={values.phoneRecordId} />
          <button type="submit">다음</button>
        </form>
      </main>
    );
  }

  const items = useMemo(() => toPayloadItems({ ...values }), [values]);

  return (
    <RecordFormShell
      pathname="/record/sleep-phone"
      action={saveRecordBatchAction}
      successRedirectPath={successRedirectPath}
      submitButtonLabel="수면/휴대폰 저장"
      initialValues={values}
    >
      {({ idempotencyKey }) => (
        <>
          <h1>수면/휴대폰</h1>
          <p>3/3 단계</p>
          <input type="hidden" name="items" value={items} readOnly />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} readOnly />
          <RecordConfirmation title="입력 확인" fields={buildSummary(values)} />
        </>
      )}
    </RecordFormShell>
  );
};
