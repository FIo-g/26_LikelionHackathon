"use client";

import { useMemo } from "react";
import Image from "next/image";
import { saveRecordBatchAction } from "@/app/(app)/record/actions";
import {
  alcoholMeasurementUnits,
  type AlcoholMeasurementUnit,
} from "@/modules/records/domain/types";
import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import {
  formatRecordWallTimeInput,
  resolveRecordWallTimeDisambiguation,
} from "@/shared/time/zoned-date-time";
import { RecordFlowHeader } from "./record-flow-header";
import { NativePickerField, RepeatedWallTimeChoice } from "./native-picker-field";
import styles from "./records.module.css";

type AlcoholStep = "type" | "amount" | "confirm";

export const INTAKE_STEPS = {
  alcohol: ["type", "amount", "confirm"] as const,
} as const;

type AlcoholFlowProps = Readonly<{
  timezone: string;
  step?: AlcoholStep | string;
  freshCreate?: boolean;
  successRedirectPath?: string;
  initialValues?: {
    recordId?: string;
    alcoholType?: string;
    servings?: string;
    measurementUnit?: string;
    consumedAt?: string;
    consumedAtDisambiguation?: string;
  };
}>;

const safeText = (value: string | undefined): string => value?.trim() ?? "";
const normalizeStep = (step?: string): AlcoholStep => step === "amount" || step === "confirm" ? step : "type";

const payloadFor = (values: Record<string, string>): string => JSON.stringify([{
  clientKey: "alcohol",
  ...(values.recordId ? { recordId: values.recordId } : {}),
  type: "alcohol",
  alcoholType: values.alcoholType,
  servings: values.servings,
  measurementUnit: values.measurementUnit,
  consumedAt: values.consumedAt,
  consumedAtDisambiguation: resolveRecordWallTimeDisambiguation(
    values.consumedAt,
    values.consumedAtDisambiguation,
    values.timezone,
  ),
  timezone: values.timezone,
}]);

const measurementUnitLabels: Record<AlcoholMeasurementUnit, string> = {
  glass: "잔",
  can: "캔",
  bottle: "병",
  other: "기타 기준",
};

const measurementUnitOptions = (alcoholType: string | undefined): readonly AlcoholMeasurementUnit[] => {
  if (alcoholType === "맥주") {
    return ["can", "bottle", "glass", "other"];
  }

  if (alcoholType === "소주") {
    return ["bottle", "glass", "other"];
  }

  return ["glass", "bottle", "can", "other"];
};

const measurementUnitLabel = (value: string | undefined): string | null => (
  typeof value === "string" && (alcoholMeasurementUnits as readonly string[]).includes(value)
    ? measurementUnitLabels[value as AlcoholMeasurementUnit]
    : null
);

const buildSummary = (values: Record<string, string>) => [
  { label: "종류", value: values.alcoholType || "-" },
  { label: "기록한 양", value: `${values.servings || "0"} ${measurementUnitLabel(values.measurementUnit) ?? "기준 미입력"}` },
  { label: "마신 시각", value: values.consumedAt || "-" },
];

const measurementGuidance = (
  alcoholType: string | undefined,
  measurementUnit: string | undefined,
): string => {
  const unit = measurementUnitLabel(measurementUnit);
  if (!unit) {
    return "마신 양 기준을 선택하면 숫자와 함께 저장돼요. 부피나 도수는 자동으로 환산하지 않아요.";
  }

  return alcoholType === "맥주"
    ? `선택한 ${unit} 기준이 마신 양과 함께 저장돼요. 캔·병·잔의 부피나 도수는 자동으로 환산하지 않아요.`
    : `선택한 ${unit} 기준이 마신 양과 함께 저장돼요. 부피나 도수는 자동으로 환산하지 않아요.`;
};

export const AlcoholFlow = ({
  timezone,
  step: requestedStep,
  freshCreate = false,
  successRedirectPath = "/record",
  initialValues = {},
}: AlcoholFlowProps) => {
  const initial = useMemo(() => {
    const suppliedConsumedAt = safeText(initialValues.consumedAt);
    const localNow = formatRecordWallTimeInput(new Date(), timezone);
    return {
      timezone,
      recordId: safeText(initialValues.recordId),
      alcoholType: safeText(initialValues.alcoholType),
      servings: safeText(initialValues.servings),
      measurementUnit: safeText(initialValues.measurementUnit),
      consumedAt: suppliedConsumedAt || localNow.value,
      consumedAtDisambiguation: safeText(initialValues.consumedAtDisambiguation)
        || (suppliedConsumedAt ? "" : localNow.disambiguation ?? ""),
    };
  }, [
    initialValues.alcoholType,
    initialValues.consumedAt,
    initialValues.consumedAtDisambiguation,
    initialValues.measurementUnit,
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
      freshCreate={freshCreate}
    >
      {({ values, step, setValue, setStep }) => (
        <main className={styles.flowPage} data-lunar-screen="record">
          <RecordFlowHeader section="알코올" />
          <div className={styles.flowContent}>
          {step === "type" ? (
            <section className={styles.flowStep} aria-labelledby="alcohol-type-title">
              <h1 id="alcohol-type-title">어떤 술을 마셨나요?</h1>
              <p className={styles.flowLead}>주종을 고른 뒤 실제 마신 양과 시간을 직접 입력해요.</p>
              <div className={styles.choiceGrid} aria-label="주종 빠른 선택">
                {["소주", "맥주", "위스키", "럼주", "기타"].map((type) => (
                  <button
                    className={values.alcoholType === type ? styles.choiceSelected : styles.choiceButton}
                    type="button"
                    key={type}
                    aria-pressed={values.alcoholType === type}
                    onClick={() => {
                      setValue("alcoholType", type);
                      if (!measurementUnitOptions(type).includes(values.measurementUnit as AlcoholMeasurementUnit)) {
                        setValue("measurementUnit", "");
                      }
                    }}
                  >
                    <strong>{type}</strong><span>기록 기준을 정해 직접 입력</span>
                  </button>
                ))}
              </div>
              <label className={styles.fieldLabel}>
                주종 직접 입력
                <input
                  aria-label="음주 종류"
                  name="alcoholType"
                  value={values.alcoholType ?? ""}
                  onChange={(event) => {
                    const nextAlcoholType = event.currentTarget.value;
                    setValue("alcoholType", nextAlcoholType);
                    if (!measurementUnitOptions(nextAlcoholType).includes(values.measurementUnit as AlcoholMeasurementUnit)) {
                      setValue("measurementUnit", "");
                    }
                  }}
                  required
                />
              </label>
              <aside className={styles.infoCard}>
                <strong>마신 양은 환산 없이 기록해요</strong>
                <p>실제 마신 양과 선택한 기준이 함께 저장돼요. 부피나 도수는 자동으로 환산하지 않아요.</p>
              </aside>
              <div className={styles.rabbitHint}>
                <p>주종을 고른 뒤 마신 양과 시간을 입력합니다.</p>
                <span className={styles.rabbitCircle}>
                  <Image src="/assets/lunar-rabbit/record-drunk-rabbit.png" alt="술병을 든 달토끼" width={120} height={120} />
                </span>
              </div>
              <button className={styles.nextButton} type="button" onClick={() => setStep("amount")}>양 입력하기</button>
            </section>
          ) : null}
          {step === "amount" ? (
            <section className={styles.flowStep} aria-labelledby="alcohol-amount-title">
              <h1 id="alcohol-amount-title">얼마나 마셨나요?</h1>
              <p className={styles.flowLead}>{values.alcoholType || "주종 미선택"} · 한 번 마신 양을 기준으로 직접 입력하세요.</p>
              <label className={styles.fieldLabel}>
                마신 양(기록 단위)
                <input aria-label="마신 양(기록 단위)" name="servings" inputMode="decimal" value={values.servings ?? ""} onChange={(event) => setValue("servings", event.currentTarget.value)} required />
              </label>
              <label className={styles.fieldLabel}>
                마신 양 기준
                <select
                  aria-label="마신 양 기준"
                  name="measurementUnit"
                  value={values.measurementUnit ?? ""}
                  onChange={(event) => setValue("measurementUnit", event.currentTarget.value)}
                  required
                >
                  <option value="" disabled>기준 선택</option>
                  {measurementUnitOptions(values.alcoholType).map((unit) => (
                    <option key={unit} value={unit}>{measurementUnitLabels[unit]}</option>
                  ))}
                </select>
              </label>
              {values.recordId && !measurementUnitLabel(values.measurementUnit) ? (
                <p className={styles.fieldHelp}>기존 기록에는 마신 양 기준이 없어요. 수정해서 선택한 기준을 함께 저장해주세요.</p>
              ) : null}
              <fieldset className={styles.quickChoices}>
                <legend>빠른 선택</legend>
                {["0.5", "1", "1.5", "2"].map((amount) => (
                  <button
                    className={values.servings === amount ? styles.quickSelected : styles.quickButton}
                    type="button"
                    key={amount}
                    aria-pressed={values.servings === amount}
                    onClick={() => setValue("servings", amount)}
                  >{amount === "0.5" ? "1/2" : amount} {measurementUnitLabel(values.measurementUnit) ?? "단위"}</button>
                ))}
              </fieldset>
              <NativePickerField
                label="마신 시각"
                name="consumedAt"
                type="datetime-local"
                value={(values.consumedAt ?? "").slice(0, 16)}
                onChange={(event) => setValue("consumedAt", event.currentTarget.value)}
                required
              />
              <RepeatedWallTimeChoice
                label="마신 시각 반복 시각 선택"
                name="consumedAtDisambiguation"
                value={values.consumedAtDisambiguation ?? ""}
                wallTime={values.consumedAt ?? ""}
                timezone={timezone}
                onChange={(value) => setValue("consumedAtDisambiguation", value)}
              />
              <aside className={styles.amountCard}>
                <span>기록될 양</span>
                <strong>{values.alcoholType || "주종"} {values.servings || "0"} {measurementUnitLabel(values.measurementUnit) ?? "기준 미입력"}</strong>
                <small>{measurementGuidance(values.alcoholType, values.measurementUnit)}</small>
                <Image src="/assets/lunar-rabbit/record-drunk-rabbit.png" alt="" width={88} height={88} />
              </aside>
              <div className={styles.stepActions}>
                <button className={styles.secondaryButton} type="button" onClick={() => setStep("type")}>이전</button>
                <button className={styles.nextButton} type="button" onClick={() => setStep("confirm")} disabled={!measurementUnitLabel(values.measurementUnit)}>기록 확인</button>
              </div>
            </section>
          ) : null}
          {step === "confirm" ? (
            <section className={styles.flowStep} aria-labelledby="alcohol-confirm-title">
              <h1 id="alcohol-confirm-title">알코올 기록을 확인해요</h1>
              <p className={styles.flowLead}>수면 분석에 반영하기 전에 주종, 양과 시간을 확인해주세요.</p>
              <input type="hidden" name="items" value={payloadFor(values)} readOnly />
              <RecordConfirmation title="입력 확인" fields={buildSummary(values)} />
              <button className={styles.secondaryButton} type="button" onClick={() => setStep("amount")}>직접 수정</button>
            </section>
          ) : null}
          </div>
        </main>
      )}
    </RecordFormShell>
  );
};
