"use client";

import { useActionState } from "react";
import { updateSleepGoalAction } from "@/app/(app)/account/actions";
import { accountActionIdle } from "../domain/schemas";
import styles from "./account.module.css";

export const SleepGoalCard = ({ goal, idPrefix = "sleep-goal" }: Readonly<{ goal: { targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number }; idPrefix?: string }>) => {
  const [state, formAction, pending] = useActionState(updateSleepGoalAction, accountActionIdle);
  const bedError = state.fieldErrors.targetBedTime?.join(" ") ?? null;
  const wakeError = state.fieldErrors.targetWakeTime?.join(" ") ?? null;
  const formMessage = state.status === "success" ? "수면 목표가 저장되었습니다." : [...(state.fieldErrors._form ?? []), ...(bedError ? [bedError] : []), ...(wakeError ? [wakeError] : [])].join(" ");
  return <form action={formAction} aria-busy={pending} className={styles.form}>
    <label htmlFor={`${idPrefix}-bed`}>취침 시간</label><input aria-describedby={bedError ? `${idPrefix}-bed-error` : undefined} aria-invalid={bedError ? true : undefined} defaultValue={state.values.targetBedTime ?? goal.targetBedTime} id={`${idPrefix}-bed`} name="targetBedTime" required type="time" />
    {bedError ? <p className={styles.error} id={`${idPrefix}-bed-error`}>{bedError}</p> : null}
    <label htmlFor={`${idPrefix}-wake`}>기상 시간</label><input aria-describedby={wakeError ? `${idPrefix}-wake-error` : undefined} aria-invalid={wakeError ? true : undefined} defaultValue={state.values.targetWakeTime ?? goal.targetWakeTime} id={`${idPrefix}-wake`} name="targetWakeTime" required type="time" />
    {wakeError ? <p className={styles.error} id={`${idPrefix}-wake-error`}>{wakeError}</p> : null}
    <p className={styles.privacyNote}>수면 시간은 서버에서 계산해 목표와 항상 일치하도록 저장합니다.</p>
    <p aria-live="polite" className={formMessage ? styles.error : styles.liveRegion} role="status">{formMessage}</p>
    <button disabled={pending} type="submit">{pending ? "저장 중" : "수면 목표 저장"}</button>
  </form>;
};
