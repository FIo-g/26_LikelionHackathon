"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { safeReturnTo } from "@/shared/auth/entry-path";
import type { RecordActionState } from "@/modules/records/application/record-service";

type DraftPayload = Readonly<{
  version: 1;
  expiresAt: number;
  idempotencyKey: string;
  values: Readonly<Record<string, string>>;
}>;

type FormValues = Record<string, string>;

type ShellProps = Readonly<{
  pathname: string;
  action: (formData: FormData) => Promise<RecordActionState>;
  children: (render: {
    values: FormValues;
    idempotencyKey: string;
    setValue: (name: string, value: string) => void;
    isSubmitting: boolean;
  }) => React.ReactNode;
  successRedirectPath?: string;
  submitButtonLabel?: string;
  initialValues?: FormValues;
}>;

const DRAFT_VERSION = 1;
const DRAFT_TTL_MS = 30 * 60 * 1000;

const toDraftKey = (pathname: string) => `record-form-draft:v${DRAFT_VERSION}:${pathname}`;

const nowMs = (): number => Date.now();

const createIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2)}-${nowMs()}`;
};

const readDraft = (pathname: string): DraftPayload | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(toDraftKey(pathname));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as DraftPayload;
    if (parsed.version !== DRAFT_VERSION || parsed.expiresAt <= nowMs()) {
      window.sessionStorage.removeItem(toDraftKey(pathname));
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const writeDraft = (pathname: string, draft: DraftPayload): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(toDraftKey(pathname), JSON.stringify(draft));
};

const clearDraft = (pathname: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(toDraftKey(pathname));
};

const mapFormValues = (formData: FormData): FormValues => {
  const values = Object.fromEntries(formData.entries()) as Record<string, string | File>;
  const normalized: FormValues = {};

  for (const [key, value] of Object.entries(values)) {
    normalized[key] = String(value);
  }

  return normalized;
};

export const RecordFormShell = ({
  pathname,
  action,
  children,
  successRedirectPath,
  submitButtonLabel = "저장",
  initialValues = {},
}: ShellProps) => {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(createIdempotencyKey);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const [state, formAction, isSubmitting] = useActionState<RecordActionState | null, FormData>(
    async (_prev, formData) => {
      const nextValues = mapFormValues(formData);
      const nextDraft: DraftPayload = {
        version: DRAFT_VERSION,
        idempotencyKey: nextValues.idempotencyKey ?? idempotencyKey,
        expiresAt: nowMs() + DRAFT_TTL_MS,
        values: nextValues,
      };
      writeDraft(pathname, nextDraft);
      const result = await action(formData);

      if (result.status === "success") {
        clearDraft(pathname);
        const freshKey = createIdempotencyKey();
        setIdempotencyKey(freshKey);
        setValues(initialValues);
        setHasAttemptedSubmit(false);
        if (successRedirectPath) {
          router.push(successRedirectPath);
        }
      } else {
        setHasAttemptedSubmit(true);
      }

      return result;
    },
    null,
  );

  useEffect(() => {
    const saved = readDraft(pathname);
    if (!saved) {
      return;
    }

    setValues({ ...saved.values });
    setIdempotencyKey(saved.idempotencyKey);
    setHasAttemptedSubmit(false);
  }, [pathname]);

  useEffect(() => {
    if (!state || state.status !== "error") {
      return;
    }

    const fromForm = state.fieldErrors?._form ?? [];
    if (fromForm.some((value) => value.toLowerCase().includes("unauthorized") || value.includes("Unauthorized"))) {
      const returnTo = encodeURIComponent(safeReturnTo(window.location.pathname + window.location.search));
      window.location.href = `/sign-in?returnTo=${returnTo}`;
      return;
    }

    const nextId = hasAttemptedSubmit ? createIdempotencyKey() : idempotencyKey;
    setIdempotencyKey(nextId);
  }, [idempotencyKey, hasAttemptedSubmit, state]);

  const setValue = (name: string, value: string): void => {
    setValues((current) => {
      const next = { ...current, [name]: value };
      const nextDraft: DraftPayload = {
        version: DRAFT_VERSION,
        idempotencyKey,
        expiresAt: nowMs() + DRAFT_TTL_MS,
        values: next,
      };
      writeDraft(pathname, nextDraft);
      return next;
    });

    if (hasAttemptedSubmit) {
      setHasAttemptedSubmit(false);
      setIdempotencyKey(createIdempotencyKey());
    }
  };

  const renderFieldErrors = (state?.status === "error") ? state.fieldErrors : null;

  const preventPasswordLeak = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!formData.get("idempotencyKey")) {
      formData.set("idempotencyKey", idempotencyKey);
    }

    void formAction(formData);
  };

  return (
    <form action={formAction} onSubmit={preventPasswordLeak}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {children({
        values,
        idempotencyKey,
        setValue,
        isSubmitting,
      })}
      <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting ? "true" : "false"}>
        {submitButtonLabel}
      </button>
      {renderFieldErrors ? (
        <ul>
          {Object.values(renderFieldErrors).flat().map((message) => (
            <li key={`${message}-${Math.random()}`}>{message}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
};
