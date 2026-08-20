"use client";

import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import { createRecordAction } from "@/app/(app)/record/actions";

type CaffeineStep = "brand" | "menu-and-amount" | "confirm";

export const INTAKE_STEPS = {
  caffeine: ["brand", "menu-and-amount", "confirm"] as const,
} as const;

type CaffeineFlowProps = Readonly<{
  timezone: string;
  step?: CaffeineStep | string;
  successRedirectPath?: string;
  initialValues?: {
    brand?: string;
    product?: string;
    caffeineMg?: string;
    consumedAt?: string;
  };
}>;

const defaultNow = (): string => new Date().toISOString().slice(0, 16);

const normalizeStep = (step?: CaffeineStep | string): CaffeineStep => {
  if (step === "menu-and-amount" || step === "confirm") {
    return step;
  }

  return "brand";
};

const safeText = (value: string | undefined): string => value?.trim() ?? "";

const buildSummary = (values: Record<string, string>) => [
  { label: "브랜드", value: values.brand || "-" },
  { label: "제품명", value: values.product || "-" },
  { label: "카페인", value: `${values.caffeineMg || "0"} mg` },
  { label: "마신 시각", value: values.consumedAt || "-" },
];

export const CaffeineFlow = ({
  timezone,
  step: rawStep,
  successRedirectPath = "/record",
  initialValues = {},
}: CaffeineFlowProps) => {
  const step = normalizeStep(rawStep);
  const values = {
    brand: safeText(initialValues.brand),
    product: safeText(initialValues.product),
    caffeineMg: safeText(initialValues.caffeineMg),
    consumedAt: safeText(initialValues.consumedAt),
  };

  if (step === "brand") {
    return (
      <main>
        <h1>카페인 기록</h1>
        <p>1/3 단계</p>
        <form action="/record/caffeine" method="get">
          <input type="hidden" name="step" value="menu-and-amount" />
          <input type="hidden" name="timezone" value={timezone} />
          <label>
            브랜드
            <input name="brand" defaultValue={values.brand} required />
          </label>
          <button type="submit">다음</button>
        </form>
      </main>
    );
  }

  if (step === "menu-and-amount") {
    return (
      <main>
        <h1>카페인 기록</h1>
        <p>2/3 단계</p>
        <form action="/record/caffeine" method="get">
          <input type="hidden" name="step" value="confirm" />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="brand" value={values.brand} />
          <label>
            제품명
            <input name="product" defaultValue={values.product} required />
          </label>
          <label>
            카페인(mg)
            <input
              name="caffeineMg"
              inputMode="numeric"
              defaultValue={values.caffeineMg}
              required
            />
          </label>
          <label>
            마신 시각
            <input
              name="consumedAt"
              type="datetime-local"
              defaultValue={values.consumedAt || defaultNow()}
              required
            />
          </label>
          <button type="submit">다음</button>
        </form>
      </main>
    );
  }

  return (
    <RecordFormShell
      pathname="/record/caffeine"
      action={createRecordAction}
      successRedirectPath={successRedirectPath}
      submitButtonLabel="카페인 저장"
      initialValues={{
        type: "caffeine",
        timezone,
        brand: values.brand,
        product: values.product,
        caffeineMg: values.caffeineMg,
        consumedAt: values.consumedAt || defaultNow(),
      }}
    >
      {({ values, idempotencyKey, setValue }) => (
        <>
          <h1>카페인 기록</h1>
          <p>3/3 단계</p>
          <input type="hidden" name="type" value="caffeine" readOnly />
          <input type="hidden" name="timezone" value={values.timezone ?? timezone} readOnly />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} readOnly />

          <label>
            브랜드
            <input
              name="brand"
              value={values.brand ?? ""}
              onChange={(event) => setValue("brand", event.currentTarget.value)}
              required
            />
          </label>
          <label>
            제품명
            <input
              name="product"
              value={values.product ?? ""}
              onChange={(event) => setValue("product", event.currentTarget.value)}
              required
            />
          </label>
          <label>
            카페인(mg)
            <input
              name="caffeineMg"
              inputMode="numeric"
              value={values.caffeineMg ?? ""}
              onChange={(event) => setValue("caffeineMg", event.currentTarget.value)}
              required
            />
          </label>
          <label>
            마신 시각
            <input
              name="consumedAt"
              type="datetime-local"
              value={(values.consumedAt ?? defaultNow()).slice(0, 16)}
              onChange={(event) => setValue("consumedAt", event.currentTarget.value)}
              required
            />
          </label>
          <RecordConfirmation title="입력 확인" fields={buildSummary(values)} />
        </>
      )}
    </RecordFormShell>
  );
};
