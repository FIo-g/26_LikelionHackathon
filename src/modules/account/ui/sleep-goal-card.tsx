"use client";

import { useActionState } from "react";
import { updateSleepGoalAction } from "@/app/(app)/account/actions";
import { accountActionIdle } from "../domain/schemas";
import styles from "./account.module.css";

export const SleepGoalCard = ({ goal }: Readonly<{ goal: { targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number } }>) => {
  const [state, formAction, pending] = useActionState(updateSleepGoalAction, accountActionIdle);
  return <form action={formAction} className={styles.form}>
    <label>취침 시간<input defaultValue={state.values.targetBedTime ?? goal.targetBedTime} name="targetBedTime" required type="time" /></label>
    <label>기상 시간<input defaultValue={state.values.targetWakeTime ?? goal.targetWakeTime} name="targetWakeTime" required type="time" /></label>
    <p className={styles.privacyNote}>수면 시간은 서버에서 계산해 목표와 항상 일치하도록 저장합니다.</p>
    {state.fieldErrors.targetWakeTime?.map((message) => <p className={styles.error} key={message} role="alert">{message}</p>)}
    {state.fieldErrors._form?.map((message) => <p className={styles.error} key={message} role="alert">{message}</p>)}
    <button disabled={pending} type="submit">{pending ? "저장 중" : "수면 목표 저장"}</button>
  </form>;
};
