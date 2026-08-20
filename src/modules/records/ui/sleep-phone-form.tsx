"use client";

import { useMemo } from "react";
import { saveRecordBatchAction } from "@/app/(app)/record/actions";
import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import { formatRecordWallTimeInput } from "@/shared/time/zoned-date-time";
import { RecordFlowHeader } from "./record-flow-header";
import styles from "./records.module.css";

type SleepPhoneStep = "sleep" | "phone" | "confirm";
type SleepPhoneFocus = "all" | "sleep" | "phone";

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
  focus?: SleepPhoneFocus | string;
  successRedirectPath?: string;
  initialValues?: RawValue;
}>;

const safeText = (value: string | undefined): string => value?.trim() ?? "";
const normalizeFocus = (focus?: string): SleepPhoneFocus => (
  focus === "sleep" || focus === "phone" ? focus : "all"
);
const normalizeStep = (step: string | undefined, focus: SleepPhoneFocus): SleepPhoneStep => {
  if (step === "confirm") return "confirm";
  if (step === "phone" || focus === "phone") return "phone";
  return "sleep";
};

const payloadFor = (values: Record<string, string>, focus: SleepPhoneFocus): string => {
  const sleep = {
    clientKey: "sleep",
    ...(values.sleepRecordId ? { recordId: values.sleepRecordId } : {}),
    type: "sleep",
    startedAt: values.sleepStartedAt,
    startedAtDisambiguation: values.sleepStartedAtDisambiguation,
    endedAt: values.sleepEndedAt,
    endedAtDisambiguation: values.sleepEndedAtDisambiguation,
    morningFatigue: values.morningFatigue,
    timezone: values.timezone,
  };
  const phone = {
    clientKey: "phone",
    ...(values.phoneRecordId ? { recordId: values.phoneRecordId } : {}),
    type: "phone-usage",
    lastUseAt: values.lastUseAt,
    lastUseAtDisambiguation: values.lastUseAtDisambiguation,
    durationMinutes: values.durationMinutes,
    timezone: values.timezone,
  };

  if (focus === "sleep") return JSON.stringify([sleep]);
  if (focus === "phone") return JSON.stringify([phone]);
  return JSON.stringify([sleep, phone]);
};

const buildSummary = (values: Record<string, string>, focus: SleepPhoneFocus) => {
  const fields = [
  { label: "수면 시작", value: values.sleepStartedAt || "-" },
  { label: "수면 종료", value: values.sleepEndedAt || "-" },
  { label: "아침 피로", value: values.morningFatigue || "-" },
  { label: "마지막 휴대폰 사용", value: values.lastUseAt || "-" },
  { label: "휴대폰 사용 시간", value: `${values.durationMinutes || "0"} 분` },
  ];
  if (focus === "sleep") return fields.slice(0, 3);
  if (focus === "phone") return fields.slice(3);
  return fields;
};

const Disambiguation = ({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) => (
  <label className={styles.fieldLabel}>
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
  focus: requestedFocus,
  successRedirectPath = "/record",
  initialValues = {},
}: SleepPhoneFlowProps) => {
  const focus = normalizeFocus(requestedFocus);
  const section = focus === "sleep" ? "수면" : focus === "phone" ? "휴대폰" : "수면 · 휴대폰";
  const submitButtonLabel = focus === "sleep"
    ? "수면 저장"
    : focus === "phone"
      ? "휴대폰 저장"
      : "수면/휴대폰 저장";
  const initial = useMemo(() => {
    const localNow = formatRecordWallTimeInput(new Date(), timezone);
    const sleepStartedAt = safeText(initialValues.sleepStartedAt);
    const sleepEndedAt = safeText(initialValues.sleepEndedAt);
    const lastUseAt = safeText(initialValues.lastUseAt);
    return {
      timezone,
      sleepStartedAt: sleepStartedAt || localNow.value,
      sleepStartedAtDisambiguation: safeText(initialValues.sleepStartedAtDisambiguation)
        || (sleepStartedAt ? "" : localNow.disambiguation ?? ""),
      sleepEndedAt: sleepEndedAt || localNow.value,
      sleepEndedAtDisambiguation: safeText(initialValues.sleepEndedAtDisambiguation)
        || (sleepEndedAt ? "" : localNow.disambiguation ?? ""),
      morningFatigue: safeText(initialValues.morningFatigue) || "1",
      sleepRecordId: safeText(initialValues.sleepRecordId),
      lastUseAt: lastUseAt || localNow.value,
      lastUseAtDisambiguation: safeText(initialValues.lastUseAtDisambiguation)
        || (lastUseAt ? "" : localNow.disambiguation ?? ""),
      durationMinutes: safeText(initialValues.durationMinutes) || "0",
      phoneRecordId: safeText(initialValues.phoneRecordId),
    };
  }, [initialValues, timezone]);

  return (
    <RecordFormShell
      pathname="/record/sleep-phone"
      action={saveRecordBatchAction}
      successRedirectPath={successRedirectPath}
      submitButtonLabel={submitButtonLabel}
      initialValues={initial}
      initialStep={normalizeStep(requestedStep, focus)}
    >
      {({ values, step, setValue, setStep }) => (
        <main className={styles.flowPage} data-lunar-screen="record">
          <RecordFlowHeader section={section} />
          <div className={styles.flowContent}>
          {step === "sleep" ? (
            <section className={styles.flowStep} aria-labelledby="sleep-title">
              <h1 id="sleep-title">수면은 어젯밤,<br />휴대폰은 오늘</h1>
              <section className={styles.sleepInputCard} aria-labelledby="sleep-card-title">
                <h2 id="sleep-card-title">어젯밤 수면 기록</h2>
                <p>직접 입력한 기상 후 어젯밤 기준으로 저장돼요.</p>
              <label className={styles.fieldLabel}>수면 시작<input type="datetime-local" name="sleepStartedAt" value={values.sleepStartedAt.slice(0, 16)} onChange={(event) => setValue("sleepStartedAt", event.currentTarget.value)} required /></label>
              <Disambiguation name="sleepStartedAtDisambiguation" value={values.sleepStartedAtDisambiguation} onChange={(value) => setValue("sleepStartedAtDisambiguation", value)} />
              <label className={styles.fieldLabel}>수면 종료<input type="datetime-local" name="sleepEndedAt" value={values.sleepEndedAt.slice(0, 16)} onChange={(event) => setValue("sleepEndedAt", event.currentTarget.value)} required /></label>
              <Disambiguation name="sleepEndedAtDisambiguation" value={values.sleepEndedAtDisambiguation} onChange={(value) => setValue("sleepEndedAtDisambiguation", value)} />
              <label className={styles.fieldLabel}>아침 피로(1-5)<input type="number" min="1" max="5" name="morningFatigue" value={values.morningFatigue} onChange={(event) => setValue("morningFatigue", event.currentTarget.value)} required /></label>
              </section>
              <button className={styles.nextButton} type="button" onClick={() => setStep(focus === "sleep" ? "confirm" : "phone")}>{focus === "sleep" ? "기록 확인" : "오늘 휴대폰 기록"}</button>
            </section>
          ) : null}
          {step === "phone" ? (
            <section className={styles.flowStep} aria-labelledby="phone-title">
              <h1 id="phone-title">수면은 어젯밤,<br />휴대폰은 오늘</h1>
              <section className={styles.phoneInputCard} aria-labelledby="phone-card-title">
                <h2 id="phone-card-title">오늘의 휴대폰 사용시간</h2>
                <span className={styles.manualPill}>직접 입력</span>
                <strong>{values.durationMinutes || "0"}분</strong>
                <p>기기 자동 연동 없이 입력한 값이 저장됩니다.</p>
              <label className={styles.fieldLabel}>마지막 휴대폰 사용<input type="datetime-local" name="lastUseAt" value={values.lastUseAt.slice(0, 16)} onChange={(event) => setValue("lastUseAt", event.currentTarget.value)} required /></label>
              <Disambiguation name="lastUseAtDisambiguation" value={values.lastUseAtDisambiguation} onChange={(value) => setValue("lastUseAtDisambiguation", value)} />
              <label className={styles.fieldLabel}>사용 시간(분)<input type="number" min="0" max="1440" name="durationMinutes" value={values.durationMinutes} onChange={(event) => setValue("durationMinutes", event.currentTarget.value)} required /></label>
              </section>
              <p className={styles.flowNote}>수면과 휴대폰 기록은 서로 다른 날짜 기준으로 저장됩니다.</p>
              <div className={styles.stepActions}>
                {focus === "all" ? <button className={styles.secondaryButton} type="button" onClick={() => setStep("sleep")}>이전</button> : null}
                <button className={styles.nextButton} type="button" onClick={() => setStep("confirm")}>기록 확인</button>
              </div>
            </section>
          ) : null}
          {step === "confirm" ? (
            <section className={styles.flowStep} aria-labelledby="sleep-confirm-title">
              <h1 id="sleep-confirm-title">{focus === "sleep" ? "수면 기록을 확인해요" : focus === "phone" ? "휴대폰 기록을 확인해요" : "수면 · 휴대폰 기록을 확인해요"}</h1>
              <p className={styles.flowLead}>어젯밤 수면과 오늘 휴대폰 값이 각각 올바른지 확인해주세요.</p>
              <input type="hidden" name="items" value={payloadFor(values, focus)} readOnly />
              <RecordConfirmation title="입력 확인" fields={buildSummary(values, focus)} />
              <button className={styles.secondaryButton} type="button" onClick={() => setStep(focus === "phone" ? "phone" : "sleep")}>직접 수정</button>
            </section>
          ) : null}
          </div>
        </main>
      )}
    </RecordFormShell>
  );
};
