"use client";

import { useMemo } from "react";
import { saveRecordBatchAction } from "@/app/(app)/record/actions";
import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import { formatRecordWallTimeInput } from "@/shared/time/zoned-date-time";
import { RecordFlowHeader } from "./record-flow-header";
import styles from "./records.module.css";

type MealHealthStep = "meal" | "exercise-and-wellness" | "confirm";
type MealHealthFocus = "all" | "meal" | "exercise";

export const INTAKE_STEPS = {
  mealHealth: ["meal", "exercise-and-wellness", "confirm"] as const,
} as const;

type RawValue = Readonly<{
  mealSize?: string;
  mealEatenAt?: string;
  mealEatenAtDisambiguation?: string;
  mealNotes?: string;
  mealRecordId?: string;
  exerciseType?: string;
  exerciseIntensity?: string;
  exerciseStartedAt?: string;
  exerciseStartedAtDisambiguation?: string;
  exerciseEndedAt?: string;
  exerciseEndedAtDisambiguation?: string;
  exerciseAverageHeartRate?: string;
  exerciseRecordId?: string;
  fatigueLevel?: string;
  stressLevel?: string;
  wellnessRecordId?: string;
  wellnessLocalDate?: string;
}>;

type MealHealthFlowProps = Readonly<{
  timezone: string;
  step?: MealHealthStep | string;
  focus?: MealHealthFocus | string;
  successRedirectPath?: string;
  initialValues?: RawValue;
}>;

const safeText = (value: string | undefined): string => value?.trim() ?? "";
const normalizeFocus = (focus?: string): MealHealthFocus => (
  focus === "meal" || focus === "exercise" ? focus : "all"
);
const normalizeStep = (step: string | undefined, focus: MealHealthFocus): MealHealthStep => {
  if (step === "confirm") return "confirm";
  if (focus === "exercise") return "exercise-and-wellness";
  return step === "exercise-and-wellness" && focus === "all" ? step : "meal";
};

const toNumberOrNull = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const payloadFor = (values: Record<string, string>, focus: MealHealthFocus): string => {
  const meal = {
    clientKey: "meal",
    ...(values.mealRecordId ? { recordId: values.mealRecordId } : {}),
    type: "meal",
    size: values.mealSize,
    eatenAt: values.mealEatenAt,
    eatenAtDisambiguation: values.mealEatenAtDisambiguation,
    notes: values.mealNotes,
    timezone: values.timezone,
  };
  const exercise = {
    clientKey: "exercise",
    ...(values.exerciseRecordId ? { recordId: values.exerciseRecordId } : {}),
    type: "exercise",
    exerciseType: values.exerciseType,
    intensity: values.exerciseIntensity,
    startedAt: values.exerciseStartedAt,
    startedAtDisambiguation: values.exerciseStartedAtDisambiguation,
    endedAt: values.exerciseEndedAt,
    endedAtDisambiguation: values.exerciseEndedAtDisambiguation,
    averageHeartRate: toNumberOrNull(values.exerciseAverageHeartRate ?? ""),
    timezone: values.timezone,
  };
  const wellness = {
    clientKey: "wellness",
    ...(values.wellnessRecordId ? { recordId: values.wellnessRecordId } : {}),
    type: "wellness",
    localDate: values.wellnessLocalDate,
    fatigueLevel: values.fatigueLevel,
    stressLevel: values.stressLevel,
    timezone: values.timezone,
  };

  if (focus === "meal") return JSON.stringify([meal]);
  if (focus === "exercise") return JSON.stringify([exercise, wellness]);
  return JSON.stringify([meal, exercise, wellness]);
};

const buildSummary = (values: Record<string, string>, focus: MealHealthFocus) => {
  const fields = [
  { label: "식사 규모", value: values.mealSize || "-" },
  { label: "식사 시각", value: values.mealEatenAt || "-" },
  { label: "운동", value: values.exerciseType || "-" },
  { label: "강도", value: values.exerciseIntensity || "-" },
  { label: "컨디션", value: `${values.fatigueLevel || "-"}/${values.stressLevel || "-"}` },
  ];
  if (focus === "meal") return fields.slice(0, 2);
  if (focus === "exercise") return fields.slice(2);
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

export const MealHealthFlow = ({
  timezone,
  step: requestedStep,
  focus: requestedFocus,
  successRedirectPath = "/record",
  initialValues = {},
}: MealHealthFlowProps) => {
  const focus = normalizeFocus(requestedFocus);
  const section = focus === "meal" ? "식사" : focus === "exercise" ? "운동 · 컨디션" : "식사 · 운동";
  const title = focus === "meal" ? "오늘의 식사 기록" : focus === "exercise" ? "오늘의 운동과 컨디션" : "오늘의 식사와 운동";
  const submitButtonLabel = focus === "meal"
    ? "식사 저장"
    : focus === "exercise"
      ? "운동·컨디션 저장"
      : "식사/운동/컨디션 저장";
  const initial = useMemo(() => {
    const localNow = formatRecordWallTimeInput(new Date(), timezone);
    const mealEatenAt = safeText(initialValues.mealEatenAt);
    const exerciseStartedAt = safeText(initialValues.exerciseStartedAt);
    const exerciseEndedAt = safeText(initialValues.exerciseEndedAt);
    return {
      timezone,
      mealSize: safeText(initialValues.mealSize) || "medium",
      mealEatenAt: mealEatenAt || localNow.value,
      mealEatenAtDisambiguation: safeText(initialValues.mealEatenAtDisambiguation)
        || (mealEatenAt ? "" : localNow.disambiguation ?? ""),
      mealNotes: safeText(initialValues.mealNotes),
      mealRecordId: safeText(initialValues.mealRecordId),
      exerciseType: safeText(initialValues.exerciseType) || "걷기",
      exerciseIntensity: safeText(initialValues.exerciseIntensity) || "medium",
      exerciseStartedAt: exerciseStartedAt || localNow.value,
      exerciseStartedAtDisambiguation: safeText(initialValues.exerciseStartedAtDisambiguation)
        || (exerciseStartedAt ? "" : localNow.disambiguation ?? ""),
      exerciseEndedAt: exerciseEndedAt || localNow.value,
      exerciseEndedAtDisambiguation: safeText(initialValues.exerciseEndedAtDisambiguation)
        || (exerciseEndedAt ? "" : localNow.disambiguation ?? ""),
      exerciseAverageHeartRate: safeText(initialValues.exerciseAverageHeartRate),
      exerciseRecordId: safeText(initialValues.exerciseRecordId),
      fatigueLevel: safeText(initialValues.fatigueLevel) || "1",
      stressLevel: safeText(initialValues.stressLevel) || "1",
      wellnessLocalDate: safeText(initialValues.wellnessLocalDate) || localNow.value.slice(0, 10),
      wellnessRecordId: safeText(initialValues.wellnessRecordId),
    };
  }, [initialValues, timezone]);

  return (
    <RecordFormShell
      pathname="/record/meal-health"
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
          {step === "meal" ? (
            <section className={styles.flowStep} aria-labelledby="meal-title">
              <h1 id="meal-title">{title}</h1>
              <h2 className={styles.subsectionTitle}>식사</h2>
              <label className={styles.fieldLabel}>
                식사량
                <select name="mealSize" value={values.mealSize} onChange={(event) => setValue("mealSize", event.currentTarget.value)}>
                  <option value="small">small</option><option value="medium">medium</option><option value="large">large</option>
                </select>
              </label>
              <label className={styles.fieldLabel}>
                식사 시각
                <input type="datetime-local" name="mealEatenAt" value={values.mealEatenAt.slice(0, 16)} onChange={(event) => setValue("mealEatenAt", event.currentTarget.value)} required />
              </label>
              <Disambiguation name="mealEatenAtDisambiguation" value={values.mealEatenAtDisambiguation} onChange={(value) => setValue("mealEatenAtDisambiguation", value)} />
              <label className={styles.fieldLabel}>
                메모
                <input name="mealNotes" value={values.mealNotes} onChange={(event) => setValue("mealNotes", event.currentTarget.value)} />
              </label>
              <aside className={styles.noticeCard}>
                <strong>식사 시간도 수면 준비에 반영돼요</strong>
                <p>저녁을 추가하면 오늘 타임라인이 함께 조정됩니다.</p>
              </aside>
              <button
                className={styles.nextButton}
                type="button"
                onClick={() => setStep(focus === "meal" ? "confirm" : "exercise-and-wellness")}
              >
                {focus === "meal" ? "기록 확인" : "운동 · 컨디션 입력"}
              </button>
            </section>
          ) : null}
          {step === "exercise-and-wellness" ? (
            <section className={styles.flowStep} aria-labelledby="exercise-title">
              <h1 id="exercise-title">{title}</h1>
              <h2 className={styles.subsectionTitle}>운동</h2>
              <div className={styles.infoCard}>
                <label className={styles.fieldLabel}>운동<input name="exerciseType" value={values.exerciseType} onChange={(event) => setValue("exerciseType", event.currentTarget.value)} required /></label>
              <label className={styles.fieldLabel}>
                강도
                <select name="exerciseIntensity" value={values.exerciseIntensity} onChange={(event) => setValue("exerciseIntensity", event.currentTarget.value)}>
                  <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
                </select>
              </label>
              <label className={styles.fieldLabel}>운동 시작<input type="datetime-local" name="exerciseStartedAt" value={values.exerciseStartedAt.slice(0, 16)} onChange={(event) => setValue("exerciseStartedAt", event.currentTarget.value)} required /></label>
              <Disambiguation name="exerciseStartedAtDisambiguation" value={values.exerciseStartedAtDisambiguation} onChange={(value) => setValue("exerciseStartedAtDisambiguation", value)} />
              <label className={styles.fieldLabel}>운동 종료<input type="datetime-local" name="exerciseEndedAt" value={values.exerciseEndedAt.slice(0, 16)} onChange={(event) => setValue("exerciseEndedAt", event.currentTarget.value)} required /></label>
              <Disambiguation name="exerciseEndedAtDisambiguation" value={values.exerciseEndedAtDisambiguation} onChange={(value) => setValue("exerciseEndedAtDisambiguation", value)} />
              <label className={styles.fieldLabel}>평균 심박수<input name="exerciseAverageHeartRate" inputMode="numeric" value={values.exerciseAverageHeartRate} onChange={(event) => setValue("exerciseAverageHeartRate", event.currentTarget.value)} /></label>
              </div>
              <h2 className={styles.subsectionTitle}>오늘의 컨디션</h2>
              <div className={styles.fieldGrid}>
                <label className={styles.fieldLabel}>피로도<input type="number" min="1" max="5" name="fatigueLevel" value={values.fatigueLevel} onChange={(event) => setValue("fatigueLevel", event.currentTarget.value)} required /></label>
                <label className={styles.fieldLabel}>스트레스<input type="number" min="1" max="5" name="stressLevel" value={values.stressLevel} onChange={(event) => setValue("stressLevel", event.currentTarget.value)} required /></label>
                <label className={styles.fieldLabel}>컨디션 날짜<input type="date" name="wellnessLocalDate" value={values.wellnessLocalDate} onChange={(event) => setValue("wellnessLocalDate", event.currentTarget.value)} required /></label>
              </div>
              <aside className={styles.noticeCard}>
                <strong>식사 시간도 수면 준비에 반영돼요</strong>
                <p>운동과 컨디션까지 저장하면 오늘 분석에 함께 반영됩니다.</p>
              </aside>
              <div className={styles.stepActions}>
                {focus === "all" ? <button className={styles.secondaryButton} type="button" onClick={() => setStep("meal")}>이전</button> : null}
                <button className={styles.nextButton} type="button" onClick={() => setStep("confirm")}>기록 확인</button>
              </div>
            </section>
          ) : null}
          {step === "confirm" ? (
            <section className={styles.flowStep} aria-labelledby="meal-confirm-title">
              <h1 id="meal-confirm-title">{focus === "meal" ? "식사 기록을 확인해요" : focus === "exercise" ? "운동 · 컨디션 기록을 확인해요" : "식사 · 운동 기록을 확인해요"}</h1>
              <p className={styles.flowLead}>입력한 생활 기록과 컨디션을 저장하기 전에 확인해주세요.</p>
              <input type="hidden" name="items" value={payloadFor(values, focus)} readOnly />
              <RecordConfirmation title="입력 확인" fields={buildSummary(values, focus)} />
              <button className={styles.secondaryButton} type="button" onClick={() => setStep(focus === "meal" ? "meal" : "exercise-and-wellness")}>직접 수정</button>
            </section>
          ) : null}
          </div>
        </main>
      )}
    </RecordFormShell>
  );
};
