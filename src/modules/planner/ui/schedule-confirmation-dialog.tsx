"use client";

import { useEffect, useRef } from "react";

import type { ScheduleDiff } from "../domain/diff-schedule-proposal";
import { formatPlanDateTime } from "./format-plan-time";
import styles from "./plan.module.css";

type ScheduleConfirmationDialogProps = Readonly<{
  title: string;
  changes: readonly ScheduleDiff[];
  timezone: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}>;

const targetSummary = (target: ScheduleDiff["after"], timezone: string): string => (
  `취침 ${formatPlanDateTime(target.targetBedAt, timezone)} / 기상 ${formatPlanDateTime(target.targetWakeAt, timezone)}`
);

const FOCUSABLE_SELECTOR = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export const ScheduleConfirmationDialog = ({
  title,
  changes,
  timezone,
  confirmLabel,
  pending = false,
  error = null,
  onCancel,
  onConfirm,
}: ScheduleConfirmationDialogProps) => {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const initiatingElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const focusableElements = (): HTMLElement[] => Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );
    const focusInitialElement = () => {
      const [first] = focusableElements();
      (first ?? dialogRef.current)?.focus();
    };
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    focusInitialElement();
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", trapFocus);
      if (initiatingElement?.isConnected) initiatingElement.focus();
    };
  }, [onCancel, pending]);

  return (
  <div className={styles.dialogBackdrop} role="presentation">
    <section ref={dialogRef} className={styles.confirmationDialog} role="dialog" aria-modal="true" aria-labelledby="schedule-confirmation-title" tabIndex={-1}>
      <div className={styles.dialogHeading}>
        <div>
          <p className={styles.eyebrow}>변경 내용 확인</p>
          <h2 id="schedule-confirmation-title">{title}</h2>
        </div>
        <button type="button" className={styles.dialogClose} onClick={onCancel} disabled={pending} aria-label="변경 취소">닫기</button>
      </div>
      <ul className={styles.changeList}>
        {changes.map((change) => (
          <li key={change.localDate}>
            <strong>{change.localDate}</strong>
            <p><span>기존</span>{change.before ? targetSummary(change.before, timezone) : "기존 계획 없음"}</p>
            <p><span>변경</span>{targetSummary(change.after, timezone)}</p>
            <details>
              <summary>준비 마감 시각 보기</summary>
              <dl>
                <div><dt>카페인</dt><dd>{formatPlanDateTime(change.after.caffeineCutoffAt, timezone)}</dd></div>
                <div><dt>운동</dt><dd>{formatPlanDateTime(change.after.exerciseCutoffAt, timezone)}</dd></div>
                <div><dt>식사</dt><dd>{formatPlanDateTime(change.after.mealCutoffAt, timezone)}</dd></div>
                <div><dt>디지털 디톡스</dt><dd>{formatPlanDateTime(change.after.windDownAt, timezone)}</dd></div>
              </dl>
            </details>
          </li>
        ))}
      </ul>
      {error ? <p className={styles.dialogError} role="alert">{error}</p> : null}
      <div className={styles.dialogActions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={pending}>취소</button>
        <button type="button" onClick={onConfirm} disabled={pending}>{pending ? "반영 중..." : confirmLabel}</button>
      </div>
    </section>
  </div>
  );
};
