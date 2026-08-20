"use client";

import { useMemo } from "react";
import { saveRecordBatchAction } from "@/app/(app)/record/actions";
import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import { formatRecordWallTime } from "@/shared/time/zoned-date-time";

type AlcoholStep = "type" | "amount" | "confirm";

export const INTAKE_STEPS = {
  alcohol: ["type", "amount", "confirm"] as const,
} as const;

type AlcoholFlowProps = Readonly<{
  timezone: string;
  step?: AlcoholStep | string;
  successRedirectPath?: string;
  initialValues?: {
    recordId?: string;
    alcoholType?: string;
    servings?: string;
    consumedAt?: string;
    consumedAtDisambiguation?: string;
  };
}>;

const defaultNow = (timezone: string): string => formatRecordWallTime(new Date(), timezone);
const safeText = (value: string | undefined): string => value?.trim() ?? "";
const normalizeStep = (step?: string): AlcoholStep => step === "amount" || step === "confirm" ? step : "type";

const payloadFor = (values: Record<string, string>): string => JSON.stringify([{
  clientKey: "alcohol",
  ...(values.recordId ? { recordId: values.recordId } : {}),
  type: "alcohol",
  alcoholType: values.alcoholType,
  servings: values.servings,
  consumedAt: values.consumedAt,
  consumedAtDisambiguation: values.consumedAtDisambiguation,
  timezone: values.timezone,
}]);

const buildSummary = (values: Record<string, string>) => [
  { label: "종류", value: values.alcoholType || "-" },
  { label: "섭취량", value: `${values.servings || "0"} 잔` },
  { label: "마신 시각", value: values.consumedAt || "-" },
];

export const AlcoholFlow = ({
  timezone,
  step: requestedStep,
  successRedirectPath = "/record",
  initialValues = {},
}: AlcoholFlowProps) => {
  const initial = useMemo(() => ({
    timezone,
    recordId: safeText(initialValues.recordId),
    alcoholType: safeText(initialValues.alcoholType),
    servings: safeText(initialValues.servings),
    consumedAt: safeText(initialValues.consumedAt) || defaultNow(timezone),
    consumedAtDisambiguation: safeText(initialValues.consumedAtDisambiguation),
  }), [
    initialValues.alcoholType,
    initialValues.consumedAt,
    initialValues.consumedAtDisambiguation,
    initialValues.recordId,
    initialValues.servings,
    timezone,
  ]);

  return (
    <RecordFormShell
      pathname="/record/alcohol"
      action={saveRecordBatchAction}
      successRedirectPath={successRedirectPath}
      submitButtonLabel="음주 저장"
      initialValues={initial}
      initialStep={normalizeStep(requestedStep)}
    >
      {({ values, step, setValue, setStep }) => (
        <main>
          <h1>음주 기록</h1>
          {step === "type" ? (
            <>
              <p>1/3 단계</p>
              <label>
                음주 종류
                <input name="alcoholType" value={values.alcoholType ?? ""} onChange={(event) => setValue("alcoholType", event.currentTarget.value)} required />
              </label>
              <button type="button" onClick={() => setStep("amount")}>다음</button>
            </>
          ) : null}
          {step === "amount" ? (
            <>
              <p>2/3 단계</p>
              <label>
                잔 수
                <input name="servings" inputMode="decimal" value={values.servings ?? ""} onChange={(event) => setValue("servings", event.currentTarget.value)} required />
              </label>
              <label>
                마신 시각
                <input name="consumedAt" type="datetime-local" value={(values.consumedAt ?? "").slice(0, 16)} onChange={(event) => setValue("consumedAt", event.currentTarget.value)} required />
              </label>
              <label>
                반복 시각 선택
                <select name="consumedAtDisambiguation" value={values.consumedAtDisambiguation ?? ""} onChange={(event) => setValue("consumedAtDisambiguation", event.currentTarget.value)}>
                  <option value="">해당 없음</option>
                  <option value="earlier">첫 번째 시각</option>
                  <option value="later">두 번째 시각</option>
                </select>
              </label>
              <button type="button" onClick={() => setStep("type")}>이전</button>
              <button type="button" onClick={() => setStep("confirm")}>다음</button>
            </>
          ) : null}
          {step === "confirm" ? (
            <>
              <p>3/3 단계</p>
              <input type="hidden" name="items" value={payloadFor(values)} readOnly />
              <RecordConfirmation title="입력 확인" fields={buildSummary(values)} />
              <button type="button" onClick={() => setStep("amount")}>이전</button>
            </>
          ) : null}
        </main>
      )}
    </RecordFormShell>
  );
};
