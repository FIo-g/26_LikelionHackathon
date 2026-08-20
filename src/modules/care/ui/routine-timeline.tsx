"use client";

import { useState, useTransition } from "react";
import { completeRoutineStepAction, undoRoutineStepAction } from "@/app/(app)/care/actions";
import type { RoutineStepViewModel } from "../domain/routine";
import styles from "./care.module.css";

const formatTime = (value: Date, timezone: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(value);

export const RoutineTimeline = ({ localDate, timezone, planDayId, routineRevisionKey, steps }: { localDate: string; timezone: string; planDayId: string | null; routineRevisionKey: string | null; steps: readonly RoutineStepViewModel[] }) => {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section className={styles.timeline} aria-labelledby="routine-title">
      <div className={styles.sectionHeading}>
        <h2 id="routine-title">오늘의 수면 준비</h2>
        <p className={styles.sectionCopy}>지금은 다음 한 단계에만 집중해요.</p>
      </div>
      {steps.length === 0 ? (
        <p className={styles.emptyState}>수면 목표를 완료하면 준비 순서를 보여드려요.</p>
      ) : (
        <ol className={styles.routineList}>
          {steps.map((step, index) => {
            const statusLabel = step.status === "done" ? "완료" : step.status === "current" ? "현재" : "예정";
            return (
              <li className={`${styles.routineItem} ${styles[`step_${step.status}`]}`} key={step.key}>
                <span className={styles.routineMarker} aria-hidden="true">{step.status === "done" ? "✓" : index + 1}</span>
                <div className={styles.routineContent}>
                  <span className={styles.statusText}>{statusLabel}</span>
                  <strong>{step.label}</strong>
                  <small>
                    <time data-testid="routine-time" data-timezone={timezone} dateTime={step.scheduledAt.toISOString()}>
                      {formatTime(step.scheduledAt, timezone)} 예정
                    </time>
                  </small>
                </div>
                <button
                  className={styles.routineAction}
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    if (!routineRevisionKey) { setMessage("현재 수면 목표에서만 루틴을 변경할 수 있어요."); return; }
                    const result = step.status === "done"
                      ? await undoRoutineStepAction({ localDate, planDayId, routineRevisionKey, stepKey: step.key })
                      : await completeRoutineStepAction({ localDate, planDayId, routineRevisionKey, stepKey: step.key });
                    setMessage(result.ok ? null : result.message ?? "루틴을 변경하지 못했어요.");
                  })}
                  type="button"
                >
                  {step.status === "done" ? "되돌리기" : "완료"}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {message ? <p className={styles.toolAlert} role="alert">{message}</p> : null}
    </section>
  );
};
