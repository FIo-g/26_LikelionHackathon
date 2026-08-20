"use client";

import { RecordConfirmation } from "./record-confirmation";
import { RecordFormShell } from "./record-form-shell";
import { createRecordAction } from "@/app/(app)/record/actions";

type AlcoholStep = "type" | "amount" | "confirm";

export const INTAKE_STEPS = {
  alcohol: ["type", "amount", "confirm"] as const,
} as const;

type AlcoholFlowProps = Readonly<{
  timezone: string;
  step?: AlcoholStep | string;
  successRedirectPath?: string;
  initialValues?: {
    alcoholType?: string;
    servings?: string;
    consumedAt?: string;
  };
}>;

const defaultNow = (): string => new Date().toISOString().slice(0, 16);

const normalizeStep = (step?: AlcoholStep | string): AlcoholStep => {
  if (step === "amount" || step === "confirm") {
    return step;
  }

  return "type";
};

const safeText = (value: string | undefined): string => value?.trim() ?? "";

const buildSummary = (values: Record<string, string>) => [
  { label: "종류", value: values.alcoholType || "-" },
  { label: "섭취량", value: `${values.servings || "0"} 잔` },
  { label: "마신 시각", value: values.consumedAt || "-" },
];

export const AlcoholFlow = ({
  timezone,
  step: rawStep,
  successRedirectPath = "/record",
  initialValues = {},
}: AlcoholFlowProps) => {
  const step = normalizeStep(rawStep);
  const values = {
    alcoholType: safeText(initialValues.alcoholType),
    servings: safeText(initialValues.servings),
    consumedAt: safeText(initialValues.consumedAt),
  };

  if (step === "type") {
    return (
      <main>
        <h1>음주 기록</h1>
        <p>1/3 단계</p>
        <form action="/record/alcohol" method="get">
          <input type="hidden" name="step" value="amount" />
          <input type="hidden" name="timezone" value={timezone} />
          <label>
            음주 종류
            <input name="alcoholType" defaultValue={values.alcoholType} required />
          </label>
          <button type="submit">다음</button>
        </form>
      </main>
    );
  }

  if (step === "amount") {
    return (
      <main>
        <h1>음주 기록</h1>
        <p>2/3 단계</p>
        <form action="/record/alcohol" method="get">
          <input type="hidden" name="step" value="confirm" />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="alcoholType" value={values.alcoholType} />
          <label>
            잔 수
            <input
              name="servings"
              inputMode="decimal"
              defaultValue={values.servings}
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
      pathname="/record/alcohol"
      action={createRecordAction}
      successRedirectPath={successRedirectPath}
      submitButtonLabel="음주 저장"
      initialValues={{
        type: "alcohol",
        timezone,
        alcoholType: values.alcoholType,
        servings: values.servings,
        consumedAt: values.consumedAt || defaultNow(),
      }}
    >
      {({ values, idempotencyKey, setValue }) => (
        <>
          <h1>음주 기록</h1>
          <p>3/3 단계</p>
          <input type="hidden" name="type" value="alcohol" readOnly />
          <input type="hidden" name="timezone" value={values.timezone ?? timezone} readOnly />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} readOnly />

          <label>
            음주 종류
            <input
              name="alcoholType"
              value={values.alcoholType ?? ""}
              onChange={(event) => setValue("alcoholType", event.currentTarget.value)}
              required
            />
          </label>
          <label>
            잔 수
            <input
              name="servings"
              inputMode="decimal"
              value={values.servings ?? ""}
              onChange={(event) => setValue("servings", event.currentTarget.value)}
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
