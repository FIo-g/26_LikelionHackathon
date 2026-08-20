"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { safeReturnTo } from "@/shared/auth/entry-path";
import type { RecordActionState } from "@/modules/records/application/record-service";
import styles from "./records.module.css";

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
  draftScope?: string;
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
  freshCreate?: boolean;
}>;

const DRAFT_VERSION = 1;
const DRAFT_TTL_MS = 30 * 60 * 1000;
const EMPTY_FORM_VALUES: FormValues = {};

export const recordDraftKey = (pathname: string, scope?: string) => (
  `record-draft:${pathname}${scope ? `:${scope}` : ""}`
);

const nowMs = (): number => Date.now();

export const createIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Server actions intentionally validate an RFC 4122 UUID. Keep the fallback
  // compatible with that contract for older WebViews that lack randomUUID().
  const randomNibble = (): string => Math.floor(Math.random() * 16).toString(16);
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Number.parseInt(randomNibble(), 16);
    return (token === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
};

export const writeRecordDraft = (pathname: string, draft: RecordDraft, scope?: string): void => {
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
  window.sessionStorage.setItem(recordDraftKey(pathname, scope), JSON.stringify(stored));
};

export const readRecordDraft = (pathname: string, scope?: string): StoredRecordDraft["draft"] | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(recordDraftKey(pathname, scope));
    if (!raw) {
      return null;
    }

    const stored = JSON.parse(raw) as StoredRecordDraft;
    if (stored.schemaVersion !== DRAFT_VERSION || stored.draft.expiresAt <= nowMs()) {
      window.sessionStorage.removeItem(recordDraftKey(pathname, scope));
      return null;
    }

    return stored.draft;
  } catch {
    return null;
  }
};

export const clearRecordDraft = (pathname: string, scope?: string): void => {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(recordDraftKey(pathname, scope));
  }
};

const mapFormValues = (formData: FormData): FormValues => {
  const values = Object.fromEntries(formData.entries()) as Record<string, string | File>;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value)]),
  );
};

// All record flows encode an existing persisted row as either `recordId` or a
// category-specific `*RecordId`. A `mode=create` link must discard only those
// edit drafts; a no-ID draft is an unfinished create and must survive a reload
// so its idempotency key can safely be retried.
const draftTargetsPersistedRecord = (values: FormValues): boolean => (
  Object.entries(values).some(([key, value]) => (
    (key === "recordId" || key.endsWith("RecordId")) && value.trim() !== ""
  ))
);

export const RecordFormShell = ({
  pathname,
  draftScope,
  action,
  children,
  successRedirectPath,
  submitButtonLabel = "저장",
  initialValues = EMPTY_FORM_VALUES,
  initialStep = "confirm",
  submitStep = "confirm",
  freshCreate = false,
}: ShellProps) => {
  const router = useRouter();
  const instanceId = useId().replaceAll(":", "");
  const formRef = useRef<HTMLFormElement>(null);
  const previousDraftIdentityRef = useRef(`${pathname}:${draftScope ?? ""}`);
  const previousFreshCreateRef = useRef(freshCreate);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [step, setCurrentStep] = useState(initialStep);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(createIdempotencyKey);

  const persist = (nextStep: string, nextValues: FormValues, nextIdempotencyKey = idempotencyKey) => {
    writeRecordDraft(pathname, {
      step: nextStep,
      values: nextValues,
      idempotencyKey: nextIdempotencyKey,
    }, draftScope);
  };

  const [state, formAction, isSubmitting] = useActionState<RecordActionState | null, FormData>(
    async (_previous, formData) => {
      const nextValues = { ...values, ...mapFormValues(formData) };
      persist(step, nextValues);
      const result = await action(formData);

      if (result.status === "success") {
        clearRecordDraft(pathname, draftScope);
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
    const draftIdentity = `${pathname}:${draftScope ?? ""}`;
    const draftScopeChanged = previousDraftIdentityRef.current !== draftIdentity;
    previousDraftIdentityRef.current = draftIdentity;
    const freshCreateActivated = freshCreate && !previousFreshCreateRef.current;
    previousFreshCreateRef.current = freshCreate;
    const saved = readRecordDraft(pathname, draftScope);
    // Focused drafts were previously stored only by pathname. Keep those
    // legacy drafts inert on normal navigation, but discard an old edit draft
    // when the user explicitly asks to start a new record.
    const legacyDraft = freshCreate && draftScope ? readRecordDraft(pathname) : null;
    if (legacyDraft && draftTargetsPersistedRecord(legacyDraft.values)) {
      clearRecordDraft(pathname);
    }
    const shouldResetForFreshCreate = freshCreate && (
      (saved !== null && draftTargetsPersistedRecord(saved.values))
      || (saved === null && freshCreateActivated)
    );

    if (shouldResetForFreshCreate) {
      if (saved) {
        clearRecordDraft(pathname, draftScope);
      }
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        setValues(initialValues);
        setCurrentStep(initialStep);
        setIdempotencyKey(createIdempotencyKey());
      });
      return () => {
        cancelled = true;
      };
    }

    if (!saved) {
      if (draftScopeChanged) {
        let cancelled = false;
        queueMicrotask(() => {
          if (cancelled) return;
          setValues(initialValues);
          setCurrentStep(initialStep);
          setIdempotencyKey(createIdempotencyKey());
        });
        return () => {
          cancelled = true;
        };
      }
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
  }, [draftScope, freshCreate, initialStep, initialValues, pathname]);

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

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    form.querySelectorAll<HTMLElement>("[data-record-error-linked='true']").forEach((field) => {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
      field.removeAttribute("data-record-error-linked");
    });
    if (!renderFieldErrors) return;
    for (const [name, messages] of Object.entries(renderFieldErrors)) {
      if (name === "_form" || messages.length === 0) continue;
      const candidate = form.elements.namedItem(name);
      const fields = candidate instanceof HTMLElement
        ? [candidate]
        : Array.from((candidate ?? []) as unknown as ArrayLike<Element>).filter((item): item is HTMLElement => item instanceof HTMLElement);
      for (const field of fields) {
        field.setAttribute("aria-invalid", "true");
        field.setAttribute("aria-describedby", `${instanceId}-${name}-error`);
        field.setAttribute("data-record-error-linked", "true");
      }
    }
  }, [instanceId, renderFieldErrors]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!formData.get("idempotencyKey")) {
      formData.set("idempotencyKey", idempotencyKey);
    }

    startTransition(() => {
      void formAction(formData);
    });
  };

  return (
    <form className={styles.recordForm} action={formAction} aria-busy={isSubmitting} onSubmit={submit} ref={formRef}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {children({ values, step, idempotencyKey, setValue, setStep, isSubmitting })}
      {step === submitStep ? (
        <button className={styles.submitButton} type="submit" disabled={isSubmitting} aria-busy={isSubmitting ? "true" : "false"}>
          {submitButtonLabel}
        </button>
      ) : null}
      <div className={styles.formStatus} aria-live="polite" role="status">
        {state?.status === "success" ? <p>저장되었습니다.</p> : null}
        {renderFieldErrors ? <ul>{Object.entries(renderFieldErrors).map(([name, messages]) => (
          name === "_form"
            ? messages.map((message, index) => <li key={`${name}-${index}-${message}`}>{message}</li>)
            : (
                <li id={`${instanceId}-${name}-error`} key={name}>
                  <ul>{messages.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul>
                </li>
              )
        ))}</ul> : null}
      </div>
    </form>
  );
};
