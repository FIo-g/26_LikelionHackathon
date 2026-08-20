"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { safeReturnTo } from "@/shared/auth/entry-path";
import type { RecordActionState } from "@/modules/records/application/record-service";

type FormValues = Record<string, string>;

export type RecordDraft = Readonly<{
  step: string;
  values: Readonly<FormValues>;
  idempotencyKey?: string;
  expiresAt?: number;
}>;

type StoredRecordDraft = Readonly<{
  schemaVersion: 1;
  draft: RecordDraft & { idempotencyKey: string; expiresAt: number };
}>;

type ShellProps = Readonly<{
  pathname: string;
  action: (formData: FormData) => Promise<RecordActionState>;
  children: (render: {
    values: FormValues;
    step: string;
    idempotencyKey: string;
    setValue: (name: string, value: string) => void;
    setStep: (step: string) => void;
    isSubmitting: boolean;
  }) => React.ReactNode;
  successRedirectPath?: string;
  submitButtonLabel?: string;
  initialValues?: FormValues;
  initialStep?: string;
  submitStep?: string;
}>;

const DRAFT_VERSION = 1;
const DRAFT_TTL_MS = 30 * 60 * 1000;

export const recordDraftKey = (pathname: string) => `record-draft:${pathname}`;

const nowMs = (): number => Date.now();

const createIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2)}-${nowMs()}`;
};

export const writeRecordDraft = (pathname: string, draft: RecordDraft): void => {
  if (typeof window === "undefined") {
    return;
  }

  const stored: StoredRecordDraft = {
    schemaVersion: DRAFT_VERSION,
    draft: {
      ...draft,
      idempotencyKey: draft.idempotencyKey ?? createIdempotencyKey(),
      expiresAt: draft.expiresAt ?? nowMs() + DRAFT_TTL_MS,
    },
  };
  window.sessionStorage.setItem(recordDraftKey(pathname), JSON.stringify(stored));
};

export const readRecordDraft = (pathname: string): StoredRecordDraft["draft"] | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(recordDraftKey(pathname));
    if (!raw) {
      return null;
    }

    const stored = JSON.parse(raw) as StoredRecordDraft;
    if (stored.schemaVersion !== DRAFT_VERSION || stored.draft.expiresAt <= nowMs()) {
      window.sessionStorage.removeItem(recordDraftKey(pathname));
      return null;
    }

    return stored.draft;
  } catch {
    return null;
  }
};

export const clearRecordDraft = (pathname: string): void => {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(recordDraftKey(pathname));
  }
};

const mapFormValues = (formData: FormData): FormValues => {
  const values = Object.fromEntries(formData.entries()) as Record<string, string | File>;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value)]),
  );
};

export const RecordFormShell = ({
  pathname,
  action,
  children,
  successRedirectPath,
  submitButtonLabel = "저장",
  initialValues = {},
  initialStep = "confirm",
  submitStep = "confirm",
}: ShellProps) => {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [step, setCurrentStep] = useState(initialStep);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(createIdempotencyKey);

  const persist = (nextStep: string, nextValues: FormValues, nextIdempotencyKey = idempotencyKey) => {
    writeRecordDraft(pathname, {
      step: nextStep,
      values: nextValues,
      idempotencyKey: nextIdempotencyKey,
    });
  };

  const [state, formAction, isSubmitting] = useActionState<RecordActionState | null, FormData>(
    async (_previous, formData) => {
      const nextValues = { ...values, ...mapFormValues(formData) };
      persist(step, nextValues);
      const result = await action(formData);

      if (result.status === "success") {
        clearRecordDraft(pathname);
        setIdempotencyKey(createIdempotencyKey());
        setValues(initialValues);
        setCurrentStep(initialStep);
        if (successRedirectPath) {
          router.push(successRedirectPath);
        }
      } else {
        const fromForm = result.fieldErrors?._form ?? [];
        if (fromForm.some((value) => value.toLowerCase().includes("unauthorized"))) {
          const returnTo = encodeURIComponent(safeReturnTo(window.location.pathname));
          router.push(`/sign-in?returnTo=${returnTo}`);
        } else {
          const nextId = createIdempotencyKey();
          setIdempotencyKey(nextId);
          persist(step, nextValues, nextId);
        }
      }

      return result;
    },
    null,
  );

  useEffect(() => {
    const saved = readRecordDraft(pathname);
    if (!saved) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setValues({ ...initialValues, ...saved.values });
      setCurrentStep(saved.step || initialStep);
      setIdempotencyKey(saved.idempotencyKey);
    });

    return () => {
      cancelled = true;
    };
  }, [initialStep, initialValues, pathname]);

  const setValue = (name: string, value: string): void => {
    setValues((current) => {
      const next = { ...current, [name]: value };
      persist(step, next);
      return next;
    });
  };

  const setStep = (nextStep: string): void => {
    setCurrentStep(nextStep);
    persist(nextStep, values);
  };

  const renderFieldErrors = state?.status === "error" ? state.fieldErrors : null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!formData.get("idempotencyKey")) {
      formData.set("idempotencyKey", idempotencyKey);
    }

    void formAction(formData);
  };

  return (
    <form action={formAction} onSubmit={submit}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {children({ values, step, idempotencyKey, setValue, setStep, isSubmitting })}
      {step === submitStep ? (
        <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting ? "true" : "false"}>
          {submitButtonLabel}
        </button>
      ) : null}
      {renderFieldErrors ? (
        <ul>
          {Object.values(renderFieldErrors).flat().map((message, index) => (
            <li key={`${index}-${message}`}>{message}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
};
