"use client";

import { useMemo } from "react";
import { saveRecordBatchAction } from "@/app/(app)/record/actions";
import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import { formatRecordWallTime } from "@/shared/time/zoned-date-time";

type CaffeineStep = "brand" | "menu-and-amount" | "confirm";

export const INTAKE_STEPS = {
  caffeine: ["brand", "menu-and-amount", "confirm"] as const,
} as const;

type CaffeineFlowProps = Readonly<{
  timezone: string;
  step?: CaffeineStep | string;
  successRedirectPath?: string;
  initialValues?: {
    recordId?: string;
    brand?: string;
    product?: string;
    caffeineMg?: string;
    consumedAt?: string;
    consumedAtDisambiguation?: string;
  };
}>;

const defaultNow = (timezone: string): string => formatRecordWallTime(new Date(), timezone);
const safeText = (value: string | undefined): string => value?.trim() ?? "";

const normalizeStep = (step?: string): CaffeineStep => (
  step === "menu-and-amount" || step === "confirm" ? step : "brand"
);

const buildSummary = (values: Record<string, string>) => [
  { label: "브랜드", value: values.brand || "-" },
  { label: "제품명", value: values.product || "-" },
  { label: "카페인", value: `${values.caffeineMg || "0"} mg` },
  { label: "마신 시각", value: values.consumedAt || "-" },
];

const payloadFor = (values: Record<string, string>): string => JSON.stringify([{
  clientKey: "caffeine",
  ...(values.recordId ? { recordId: values.recordId } : {}),
  type: "caffeine",
  brand: values.brand,
  product: values.product,
  caffeineMg: values.caffeineMg,
  consumedAt: values.consumedAt,
  consumedAtDisambiguation: values.consumedAtDisambiguation,
  timezone: values.timezone,
}]);

export const CaffeineFlow = ({
  timezone,
  step: requestedStep,
  successRedirectPath = "/record",
  initialValues = {},
}: CaffeineFlowProps) => {
  const initial = useMemo(() => ({
    timezone,
    recordId: safeText(initialValues.recordId),
    brand: safeText(initialValues.brand),
    product: safeText(initialValues.product),
    caffeineMg: safeText(initialValues.caffeineMg),
    consumedAt: safeText(initialValues.consumedAt) || defaultNow(timezone),
    consumedAtDisambiguation: safeText(initialValues.consumedAtDisambiguation),
  }), [
    initialValues.brand,
    initialValues.caffeineMg,
    initialValues.consumedAt,
    initialValues.consumedAtDisambiguation,
    initialValues.product,
    initialValues.recordId,
    timezone,
  ]);

  return (
    <RecordFormShell
      pathname="/record/caffeine"
      action={saveRecordBatchAction}
      successRedirectPath={successRedirectPath}
      submitButtonLabel="카페인 저장"
      initialValues={initial}
      initialStep={normalizeStep(requestedStep)}
    >
      {({ values, step, setValue, setStep }) => (
        <main>
          <h1>카페인 기록</h1>
          {step === "brand" ? (
            <>
              <p>1/3 단계</p>
              <label>
                브랜드
                <input name="brand" value={values.brand ?? ""} onChange={(event) => setValue("brand", event.currentTarget.value)} required />
              </label>
              <button type="button" onClick={() => setStep("menu-and-amount")}>다음</button>
            </>
          ) : null}
          {step === "menu-and-amount" ? (
            <>
              <p>2/3 단계</p>
              <label>
                제품명
                <input name="product" value={values.product ?? ""} onChange={(event) => setValue("product", event.currentTarget.value)} required />
              </label>
              <label>
                카페인(mg)
                <input name="caffeineMg" inputMode="numeric" value={values.caffeineMg ?? ""} onChange={(event) => setValue("caffeineMg", event.currentTarget.value)} required />
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
              <button type="button" onClick={() => setStep("brand")}>이전</button>
              <button type="button" onClick={() => setStep("confirm")}>다음</button>
            </>
          ) : null}
          {step === "confirm" ? (
            <>
              <p>3/3 단계</p>
              <input type="hidden" name="items" value={payloadFor(values)} readOnly />
              <RecordConfirmation title="입력 확인" fields={buildSummary(values)} />
              <button type="button" onClick={() => setStep("menu-and-amount")}>이전</button>
            </>
          ) : null}
        </main>
      )}
    </RecordFormShell>
  );
};
