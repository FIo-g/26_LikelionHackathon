"use client";

import { useMemo } from "react";
import Image from "next/image";
import { saveRecordBatchAction } from "@/app/(app)/record/actions";
import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import {
  formatRecordWallTimeInput,
  resolveRecordWallTimeDisambiguation,
} from "@/shared/time/zoned-date-time";
import { RecordFlowHeader } from "./record-flow-header";
import { NativePickerField, RepeatedWallTimeChoice } from "./native-picker-field";
import styles from "./records.module.css";

type CaffeineStep = "brand" | "menu-and-amount" | "confirm";

export const INTAKE_STEPS = {
  caffeine: ["brand", "menu-and-amount", "confirm"] as const,
} as const;

type CaffeineFlowProps = Readonly<{
  timezone: string;
  step?: CaffeineStep | string;
  freshCreate?: boolean;
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
  consumedAtDisambiguation: resolveRecordWallTimeDisambiguation(
    values.consumedAt,
    values.consumedAtDisambiguation,
    values.timezone,
  ),
  timezone: values.timezone,
}]);

export const CaffeineFlow = ({
  timezone,
  step: requestedStep,
  freshCreate = false,
  successRedirectPath = "/record",
  initialValues = {},
}: CaffeineFlowProps) => {
  const initial = useMemo(() => {
    const suppliedConsumedAt = safeText(initialValues.consumedAt);
    const localNow = formatRecordWallTimeInput(new Date(), timezone);
    return {
      timezone,
      recordId: safeText(initialValues.recordId),
      brand: safeText(initialValues.brand),
      product: safeText(initialValues.product),
      caffeineMg: safeText(initialValues.caffeineMg),
      consumedAt: suppliedConsumedAt || localNow.value,
      consumedAtDisambiguation: safeText(initialValues.consumedAtDisambiguation)
        || (suppliedConsumedAt ? "" : localNow.disambiguation ?? ""),
    };
  }, [
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
      freshCreate={freshCreate}
    >
      {({ values, step, setValue, setStep }) => (
        <main className={styles.flowPage} data-lunar-screen="record">
          <RecordFlowHeader section="카페인" />
          <div className={styles.flowContent}>
          {step === "brand" ? (
            <section className={styles.flowStep} aria-labelledby="caffeine-brand-title">
              <h1 id="caffeine-brand-title">어디서 마셨나요?</h1>
              <p className={styles.flowLead}>브랜드를 선택하면 메뉴별 카페인 양을 확인할 수 있어요.</p>
              <div className={styles.choiceGrid} aria-label="브랜드 빠른 선택">
                {["스타벅스", "메가커피", "개인 카페", "그 외"].map((brand) => (
                  <button
                    className={values.brand === brand ? styles.choiceSelected : styles.choiceButton}
                    type="button"
                    key={brand}
                    aria-pressed={values.brand === brand}
                    onClick={() => setValue("brand", brand)}
                  >
                    <strong>{brand}</strong>
                    <span>{brand === "스타벅스" || brand === "메가커피" ? "메뉴 DB 사용" : "평균치로 시작"}</span>
                  </button>
                ))}
              </div>
              <aside className={styles.noticeCard}>
                <strong>개인 카페 · 그 외는 평균치로 기록돼요</strong>
                <p>나중에 실제 수치를 확인해 수정할 수 있습니다.</p>
              </aside>
              <div className={styles.rabbitHint}>
                <p>브랜드를 고르면 메뉴 단계로 이어집니다.<br />정확한 수치는 저장 전에 다시 확인해요.</p>
                <span className={styles.rabbitCircle}>
                  <Image src="/assets/lunar-rabbit/record-default-rabbit.png" alt="달토끼" width={96} height={96} />
                </span>
              </div>
              <label className={styles.fieldLabel}>
                브랜드
                <input name="brand" value={values.brand ?? ""} onChange={(event) => setValue("brand", event.currentTarget.value)} required />
              </label>
              <button className={styles.nextButton} type="button" onClick={() => setStep("menu-and-amount")}>메뉴 선택하기</button>
            </section>
          ) : null}
          {step === "menu-and-amount" ? (
            <section className={styles.flowStep} aria-labelledby="caffeine-menu-title">
              <h1 id="caffeine-menu-title">무엇을 마셨나요?</h1>
              <p className={styles.flowLead}>{values.brand || "브랜드 미선택"} · 메뉴 선택 · 수치 확인</p>
              <div className={styles.menuList} aria-label="메뉴 빠른 선택">
                {["아메리카노", "카페 라떼", "콜드 브루"].map((product) => (
                  <button
                    className={values.product === product ? styles.menuSelected : styles.menuButton}
                    type="button"
                    key={product}
                    aria-pressed={values.product === product}
                    onClick={() => setValue("product", product)}
                  >
                    <strong>{product}</strong><span>메뉴를 선택한 뒤 실제 용량을 확인하세요</span>
                  </button>
                ))}
              </div>
              <div className={styles.fieldGrid}>
              <label className={styles.fieldLabel}>
                제품명
                <input name="product" value={values.product ?? ""} onChange={(event) => setValue("product", event.currentTarget.value)} required />
              </label>
              <label className={styles.fieldLabel}>
                카페인(mg)
                <input name="caffeineMg" inputMode="numeric" value={values.caffeineMg ?? ""} onChange={(event) => setValue("caffeineMg", event.currentTarget.value)} required />
              </label>
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
              </div>
              <aside className={styles.metricCard}>
                <span>기록될 카페인 양</span>
                <strong>{values.caffeineMg || "0"} mg</strong>
                <small>수치가 다르면 직접 수정할 수 있어요.</small>
              </aside>
              <div className={styles.stepActions}>
                <button className={styles.secondaryButton} type="button" onClick={() => setStep("brand")}>이전</button>
                <button className={styles.nextButton} type="button" onClick={() => setStep("confirm")}>수치 확인하기</button>
              </div>
            </section>
          ) : null}
          {step === "confirm" ? (
            <section className={styles.flowStep} aria-labelledby="caffeine-confirm-title">
              <h1 id="caffeine-confirm-title">카페인 기록을 확인해요</h1>
              <p className={styles.flowLead}>저장 전 브랜드, 메뉴, 수치와 시간을 확인해주세요.</p>
              <input type="hidden" name="items" value={payloadFor(values)} readOnly />
              <RecordConfirmation title="입력 확인" fields={buildSummary(values)} />
              <button className={styles.secondaryButton} type="button" onClick={() => setStep("menu-and-amount")}>직접 수정</button>
            </section>
          ) : null}
          </div>
        </main>
      )}
    </RecordFormShell>
  );
};
