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
      <p className={styles.eyebrow}>NIGHT ROUTINE</p><h2 id="routine-title">오늘의 준비</h2>
      {steps.length === 0 ? <p>수면 목표를 완료하면 준비 순서를 보여드려요.</p> : <ol>
        {steps.map((step) => <li className={styles[`step_${step.status}`]} key={step.key}>
          <span aria-hidden="true">{step.status === "done" ? "✓" : step.status === "current" ? "●" : "○"}</span>
          <div><strong>{step.label}</strong><small><time data-testid="routine-time" data-timezone={timezone} dateTime={step.scheduledAt.toISOString()}>{formatTime(step.scheduledAt, timezone)}</time></small></div>
          <button disabled={pending} onClick={() => startTransition(async () => {
            if (!routineRevisionKey) { setMessage("현재 수면 목표에서만 루틴을 변경할 수 있어요."); return; }
            const result = step.status === "done"
              ? await undoRoutineStepAction({ localDate, planDayId, routineRevisionKey, stepKey: step.key })
              : await completeRoutineStepAction({ localDate, planDayId, routineRevisionKey, stepKey: step.key });
            setMessage(result.ok ? null : result.message ?? "루틴을 변경하지 못했어요.");
          })} type="button">{step.status === "done" ? "되돌리기" : "완료"}</button>
        </li>)}
      </ol>}
      {message ? <p role="alert">{message}</p> : null}
    </section>
  );
};
