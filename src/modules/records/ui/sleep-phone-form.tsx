"use client";

import { useMemo } from "react";
import { saveRecordBatchAction } from "@/app/(app)/record/actions";
import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";

type SleepPhoneStep = "sleep" | "phone" | "confirm";

export const INTAKE_STEPS = {
  sleepPhone: ["sleep", "phone", "confirm"] as const,
} as const;

type RawValue = Readonly<{
  sleepStartedAt?: string;
  sleepStartedAtDisambiguation?: string;
  sleepEndedAt?: string;
  sleepEndedAtDisambiguation?: string;
  morningFatigue?: string;
  sleepRecordId?: string;
  lastUseAt?: string;
  lastUseAtDisambiguation?: string;
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
const normalizeStep = (step?: string): SleepPhoneStep => step === "phone" || step === "confirm" ? step : "sleep";

const payloadFor = (values: Record<string, string>): string => JSON.stringify([
  {
    clientKey: "sleep",
    ...(values.sleepRecordId ? { recordId: values.sleepRecordId } : {}),
    type: "sleep",
    startedAt: values.sleepStartedAt,
    startedAtDisambiguation: values.sleepStartedAtDisambiguation,
    endedAt: values.sleepEndedAt,
    endedAtDisambiguation: values.sleepEndedAtDisambiguation,
    morningFatigue: values.morningFatigue,
    timezone: values.timezone,
  },
  {
    clientKey: "phone",
    ...(values.phoneRecordId ? { recordId: values.phoneRecordId } : {}),
    type: "phone-usage",
    lastUseAt: values.lastUseAt,
    lastUseAtDisambiguation: values.lastUseAtDisambiguation,
    durationMinutes: values.durationMinutes,
    timezone: values.timezone,
  },
]);

const buildSummary = (values: Record<string, string>) => [
  { label: "수면 시작", value: values.sleepStartedAt || "-" },
  { label: "수면 종료", value: values.sleepEndedAt || "-" },
  { label: "아침 피로", value: values.morningFatigue || "-" },
  { label: "마지막 휴대폰 사용", value: values.lastUseAt || "-" },
  { label: "휴대폰 사용 시간", value: `${values.durationMinutes || "0"} 분` },
];

const Disambiguation = ({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) => (
  <label>
    반복 시각 선택
    <select name={name} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
      <option value="">해당 없음</option>
      <option value="earlier">첫 번째 시각</option>
      <option value="later">두 번째 시각</option>
    </select>
  </label>
);

export const SleepPhoneFlow = ({
  timezone,
  step: requestedStep,
  successRedirectPath = "/record",
  initialValues = {},
}: SleepPhoneFlowProps) => {
  const initial = useMemo(() => ({
    timezone,
    sleepStartedAt: safeText(initialValues.sleepStartedAt) || defaultNow(),
    sleepStartedAtDisambiguation: safeText(initialValues.sleepStartedAtDisambiguation),
    sleepEndedAt: safeText(initialValues.sleepEndedAt) || defaultNow(),
    sleepEndedAtDisambiguation: safeText(initialValues.sleepEndedAtDisambiguation),
    morningFatigue: safeText(initialValues.morningFatigue) || "1",
    sleepRecordId: safeText(initialValues.sleepRecordId),
    lastUseAt: safeText(initialValues.lastUseAt) || defaultNow(),
    lastUseAtDisambiguation: safeText(initialValues.lastUseAtDisambiguation),
    durationMinutes: safeText(initialValues.durationMinutes) || "0",
    phoneRecordId: safeText(initialValues.phoneRecordId),
  }), [initialValues, timezone]);

  return (
    <RecordFormShell
      pathname="/record/sleep-phone"
      action={saveRecordBatchAction}
      successRedirectPath={successRedirectPath}
      submitButtonLabel="수면/휴대폰 저장"
      initialValues={initial}
      initialStep={normalizeStep(requestedStep)}
    >
      {({ values, step, setValue, setStep }) => (
        <main>
          <h1>수면/휴대폰</h1>
          {step === "sleep" ? (
            <>
              <p>1/3 단계</p>
              <label>수면 시작<input type="datetime-local" name="sleepStartedAt" value={values.sleepStartedAt.slice(0, 16)} onChange={(event) => setValue("sleepStartedAt", event.currentTarget.value)} required /></label>
              <Disambiguation name="sleepStartedAtDisambiguation" value={values.sleepStartedAtDisambiguation} onChange={(value) => setValue("sleepStartedAtDisambiguation", value)} />
              <label>수면 종료<input type="datetime-local" name="sleepEndedAt" value={values.sleepEndedAt.slice(0, 16)} onChange={(event) => setValue("sleepEndedAt", event.currentTarget.value)} required /></label>
              <Disambiguation name="sleepEndedAtDisambiguation" value={values.sleepEndedAtDisambiguation} onChange={(value) => setValue("sleepEndedAtDisambiguation", value)} />
              <label>아침 피로(1-5)<input type="number" min="1" max="5" name="morningFatigue" value={values.morningFatigue} onChange={(event) => setValue("morningFatigue", event.currentTarget.value)} required /></label>
              <button type="button" onClick={() => setStep("phone")}>다음</button>
            </>
          ) : null}
          {step === "phone" ? (
            <>
              <p>2/3 단계</p>
              <label>마지막 휴대폰 사용<input type="datetime-local" name="lastUseAt" value={values.lastUseAt.slice(0, 16)} onChange={(event) => setValue("lastUseAt", event.currentTarget.value)} required /></label>
              <Disambiguation name="lastUseAtDisambiguation" value={values.lastUseAtDisambiguation} onChange={(value) => setValue("lastUseAtDisambiguation", value)} />
              <label>사용 시간(분)<input type="number" min="0" max="1440" name="durationMinutes" value={values.durationMinutes} onChange={(event) => setValue("durationMinutes", event.currentTarget.value)} required /></label>
              <button type="button" onClick={() => setStep("sleep")}>이전</button>
              <button type="button" onClick={() => setStep("confirm")}>다음</button>
            </>
          ) : null}
          {step === "confirm" ? (
            <>
              <p>3/3 단계</p>
              <input type="hidden" name="items" value={payloadFor(values)} readOnly />
              <RecordConfirmation title="입력 확인" fields={buildSummary(values)} />
              <button type="button" onClick={() => setStep("phone")}>이전</button>
            </>
          ) : null}
        </main>
      )}
    </RecordFormShell>
  );
};
