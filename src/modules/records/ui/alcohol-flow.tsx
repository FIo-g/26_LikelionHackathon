"use client";

import { useMemo } from "react";
import Image from "next/image";
import { saveRecordBatchAction } from "@/app/(app)/record/actions";
import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import { formatRecordWallTimeInput } from "@/shared/time/zoned-date-time";
import { RecordFlowHeader } from "./record-flow-header";
import styles from "./records.module.css";

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
  const initial = useMemo(() => {
    const suppliedConsumedAt = safeText(initialValues.consumedAt);
    const localNow = formatRecordWallTimeInput(new Date(), timezone);
    return {
      timezone,
      recordId: safeText(initialValues.recordId),
      alcoholType: safeText(initialValues.alcoholType),
      servings: safeText(initialValues.servings),
      consumedAt: suppliedConsumedAt || localNow.value,
      consumedAtDisambiguation: safeText(initialValues.consumedAtDisambiguation)
        || (suppliedConsumedAt ? "" : localNow.disambiguation ?? ""),
    };
  }, [
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
        <main className={styles.flowPage} data-lunar-screen="record">
          <RecordFlowHeader section="알코올" />
          <div className={styles.flowContent}>
          {step === "type" ? (
            <section className={styles.flowStep} aria-labelledby="alcohol-type-title">
              <h1 id="alcohol-type-title">어떤 술을 마셨나요?</h1>
              <p className={styles.flowLead}>주종별 평균값으로 시작하고, 저장 전에 직접 고칠 수 있어요.</p>
              <div className={styles.choiceGrid} aria-label="주종 빠른 선택">
                {["소주", "맥주", "위스키", "럼주", "기타"].map((type) => (
                  <button
                    className={values.alcoholType === type ? styles.choiceSelected : styles.choiceButton}
                    type="button"
                    key={type}
                    aria-pressed={values.alcoholType === type}
                    onClick={() => setValue("alcoholType", type)}
                  >
                    <strong>{type}</strong><span>{type === "소주" || type === "맥주" ? "병 단위 기록" : type === "기타" ? "평균값으로 시작" : "잔 단위 기록"}</span>
                  </button>
                ))}
              </div>
              <label className={styles.fieldLabel}>
                주종 직접 입력
                <input aria-label="음주 종류" name="alcoholType" value={values.alcoholType ?? ""} onChange={(event) => setValue("alcoholType", event.currentTarget.value)} required />
              </label>
              <aside className={styles.infoCard}>
                <strong>주종 목록은 계속 확장할 수 있어요</strong>
                <p>목록에 없다면 기타를 선택한 뒤 실제 주종을 입력해주세요.</p>
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
              <p className={styles.flowLead}>{values.alcoholType || "주종 미선택"} · 실제 마신 양을 입력하세요.</p>
              <label className={styles.fieldLabel}>
                마신 양
                <input aria-label="잔 수" name="servings" inputMode="decimal" value={values.servings ?? ""} onChange={(event) => setValue("servings", event.currentTarget.value)} required />
              </label>
              <fieldset className={styles.quickChoices}>
                <legend>빠른 선택</legend>
                {["0.5", "1", "1.5", "2"].map((amount) => (
                  <button
                    className={values.servings === amount ? styles.quickSelected : styles.quickButton}
                    type="button"
                    key={amount}
                    aria-pressed={values.servings === amount}
                    onClick={() => setValue("servings", amount)}
                  >{amount === "0.5" ? "1/2" : amount}잔</button>
                ))}
              </fieldset>
              <label className={styles.fieldLabel}>
                마신 시각
                <input name="consumedAt" type="datetime-local" value={(values.consumedAt ?? "").slice(0, 16)} onChange={(event) => setValue("consumedAt", event.currentTarget.value)} required />
              </label>
              <label className={styles.fieldLabel}>
                반복 시각 선택
                <select name="consumedAtDisambiguation" value={values.consumedAtDisambiguation ?? ""} onChange={(event) => setValue("consumedAtDisambiguation", event.currentTarget.value)}>
                  <option value="">해당 없음</option>
                  <option value="earlier">첫 번째 시각</option>
                  <option value="later">두 번째 시각</option>
                </select>
              </label>
              <aside className={styles.amountCard}>
                <span>기록될 평균 추정치</span>
                <strong>{values.alcoholType || "주종"} {values.servings || "0"}잔</strong>
                <small>잔이나 병의 실제 크기가 다르면 저장 전 수정해주세요.</small>
                <Image src="/assets/lunar-rabbit/record-drunk-rabbit.png" alt="" width={88} height={88} />
              </aside>
              <div className={styles.stepActions}>
                <button className={styles.secondaryButton} type="button" onClick={() => setStep("type")}>이전</button>
                <button className={styles.nextButton} type="button" onClick={() => setStep("confirm")}>기록 확인</button>
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
