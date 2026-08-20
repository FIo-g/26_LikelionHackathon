"use client";

import { useMemo } from "react";
import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import { saveRecordBatchAction } from "@/app/(app)/record/actions";

type MealHealthStep = "meal" | "exercise-and-wellness" | "confirm";

export const INTAKE_STEPS = {
  mealHealth: ["meal", "exercise-and-wellness", "confirm"] as const,
} as const;

type RawValue = Readonly<{
  mealSize?: string;
  mealEatenAt?: string;
  mealNotes?: string;
  mealRecordId?: string;
  exerciseType?: string;
  exerciseIntensity?: string;
  exerciseStartedAt?: string;
  exerciseEndedAt?: string;
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
  successRedirectPath?: string;
  initialValues?: RawValue;
}>;

const defaultNow = (): string => new Date().toISOString().slice(0, 16);
const todayDate = (): string => new Date().toISOString().slice(0, 10);
const safeText = (value: string | undefined): string => value?.trim() ?? "";

const normalizeStep = (step?: MealHealthStep | string): MealHealthStep => {
  if (step === "exercise-and-wellness" || step === "confirm") {
    return step;
  }

  return "meal";
};

const toNumberOrNull = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toPayloadItems = (values: Record<string, string>): string => {
  const items = [
    {
      clientKey: "meal",
      ...(safeText(values.mealRecordId) ? { recordId: values.mealRecordId } : {}),
      type: "meal" as const,
      size: safeText(values.mealSize) || "medium",
      eatenAt: safeText(values.mealEatenAt) || defaultNow(),
      notes: safeText(values.mealNotes),
      timezone: values.timezone,
    },
    {
      clientKey: "exercise",
      ...(safeText(values.exerciseRecordId) ? { recordId: values.exerciseRecordId } : {}),
      type: "exercise" as const,
      exerciseType: safeText(values.exerciseType) || "걷기",
      intensity: safeText(values.exerciseIntensity) || "medium",
      startedAt: safeText(values.exerciseStartedAt) || defaultNow(),
      endedAt: safeText(values.exerciseEndedAt) || defaultNow(),
      averageHeartRate: toNumberOrNull(values.exerciseAverageHeartRate),
      timezone: values.timezone,
    },
    {
      clientKey: "wellness",
      ...(safeText(values.wellnessRecordId) ? { recordId: values.wellnessRecordId } : {}),
      type: "wellness" as const,
      localDate: safeText(values.wellnessLocalDate) || todayDate(),
      fatigueLevel: toNumberOrNull(values.fatigueLevel) ?? 1,
      stressLevel: toNumberOrNull(values.stressLevel) ?? 1,
      timezone: values.timezone,
    },
  ];

  return JSON.stringify(items);
};

const buildSummary = (values: Record<string, string>) => [
  { label: "식사 규모", value: safeText(values.mealSize) || "-" },
  { label: "식사 시각", value: safeText(values.mealEatenAt) || "-" },
  { label: "운동", value: safeText(values.exerciseType) || "-" },
  { label: "강도", value: safeText(values.exerciseIntensity) || "-" },
  { label: "컨디션", value: `${safeText(values.fatigueLevel) || "-"}/${safeText(values.stressLevel) || "-"}` },
];

export const MealHealthFlow = ({
  timezone,
  step: rawStep,
  successRedirectPath = "/record",
  initialValues = {},
}: MealHealthFlowProps) => {
  const step = normalizeStep(rawStep);
  const values = {
    timezone,
    mealSize: safeText(initialValues.mealSize) || "medium",
    mealEatenAt: safeText(initialValues.mealEatenAt) || defaultNow(),
    mealNotes: safeText(initialValues.mealNotes),
    mealRecordId: safeText(initialValues.mealRecordId),
    exerciseType: safeText(initialValues.exerciseType) || "걷기",
    exerciseIntensity: safeText(initialValues.exerciseIntensity) || "medium",
    exerciseStartedAt: safeText(initialValues.exerciseStartedAt) || defaultNow(),
    exerciseEndedAt: safeText(initialValues.exerciseEndedAt) || defaultNow(),
    exerciseAverageHeartRate: safeText(initialValues.exerciseAverageHeartRate),
    exerciseRecordId: safeText(initialValues.exerciseRecordId),
    fatigueLevel: safeText(initialValues.fatigueLevel) || "1",
    stressLevel: safeText(initialValues.stressLevel) || "1",
    wellnessLocalDate: safeText(initialValues.wellnessLocalDate) || todayDate(),
    wellnessRecordId: safeText(initialValues.wellnessRecordId),
  };

  if (step === "meal") {
    return (
      <main>
        <h1>식사/운동/컨디션</h1>
        <p>1/3 단계</p>
        <form action="/record/meal-health" method="get">
          <input type="hidden" name="step" value="exercise-and-wellness" />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="mealRecordId" value={values.mealRecordId} />

          <label>
            식사량
            <select name="mealSize" defaultValue={values.mealSize}>
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large">large</option>
            </select>
          </label>
          <label>
            식사 시각
            <input type="datetime-local" name="mealEatenAt" defaultValue={values.mealEatenAt} required />
          </label>
          <label>
            메모
            <input name="mealNotes" defaultValue={values.mealNotes} />
          </label>
          <button type="submit">다음</button>
        </form>
      </main>
    );
  }

  if (step === "exercise-and-wellness") {
    return (
      <main>
        <h1>식사/운동/컨디션</h1>
        <p>2/3 단계</p>
        <form action="/record/meal-health" method="get">
          <input type="hidden" name="step" value="confirm" />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="mealSize" value={values.mealSize} />
          <input type="hidden" name="mealEatenAt" value={values.mealEatenAt} />
          <input type="hidden" name="mealNotes" value={values.mealNotes} />
          <input type="hidden" name="mealRecordId" value={values.mealRecordId} />

          <label>
            운동
            <input name="exerciseType" defaultValue={values.exerciseType} required />
          </label>
          <label>
            강도
            <select name="exerciseIntensity" defaultValue={values.exerciseIntensity}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
          <label>
            운동 시작
            <input type="datetime-local" name="exerciseStartedAt" defaultValue={values.exerciseStartedAt} required />
          </label>
          <label>
            운동 종료
            <input type="datetime-local" name="exerciseEndedAt" defaultValue={values.exerciseEndedAt} required />
          </label>
          <label>
            평균 심박수
            <input
              name="exerciseAverageHeartRate"
              inputMode="numeric"
              defaultValue={values.exerciseAverageHeartRate}
            />
          </label>
          <label>
            피로도
            <input type="number" min="1" max="5" name="fatigueLevel" defaultValue={values.fatigueLevel} required />
          </label>
          <label>
            스트레스
            <input type="number" min="1" max="5" name="stressLevel" defaultValue={values.stressLevel} required />
          </label>
          <label>
            컨디션 날짜
            <input type="date" name="wellnessLocalDate" defaultValue={values.wellnessLocalDate} required />
          </label>
          <input type="hidden" name="wellnessRecordId" value={values.wellnessRecordId} />
          <button type="submit">다음</button>
        </form>
      </main>
    );
  }

  const items = useMemo(() => toPayloadItems({ ...values }), [values]);

  return (
    <RecordFormShell
      pathname="/record/meal-health"
      action={saveRecordBatchAction}
      successRedirectPath={successRedirectPath}
      submitButtonLabel="식사/운동/컨디션 저장"
      initialValues={values}
    >
      {({ idempotencyKey }) => (
        <>
          <h1>식사/운동/컨디션</h1>
          <p>3/3 단계</p>
          <input type="hidden" name="items" value={items} readOnly />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} readOnly />
          <RecordConfirmation title="입력 확인" fields={buildSummary(values)} />
        </>
      )}
    </RecordFormShell>
  );
};
