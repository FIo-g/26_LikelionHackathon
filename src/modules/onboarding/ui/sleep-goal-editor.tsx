"use client";

import { useState } from "react";
import styles from "./onboarding.module.css";

type SleepGoalEditorProps = Readonly<{
  targetBedTime: string;
  targetWakeTime: string;
}>;

/**
 * The resting state intentionally mirrors the Figma card. Time inputs appear
 * only after the explicit edit affordance is activated, while hidden form
 * values keep the no-JavaScript form submission contract intact.
 */
export const SleepGoalEditor = ({ targetBedTime: initialBedTime, targetWakeTime: initialWakeTime }: SleepGoalEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [targetBedTime, setTargetBedTime] = useState(initialBedTime);
  const [targetWakeTime, setTargetWakeTime] = useState(initialWakeTime);

  return (
    <>
      <input name="targetBedTime" type="hidden" value={targetBedTime} />
      <input name="targetWakeTime" type="hidden" value={targetWakeTime} />
      <section className={styles.goalCard} aria-label="목표 수면 리듬">
        <strong>목표 수면 리듬</strong>
        <div className={styles.goalTimeRow}>
          <div>
            <time dateTime={targetBedTime}>{targetBedTime}</time>
            <span>잠들기</span>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <time dateTime={targetWakeTime}>{targetWakeTime}</time>
            <span>일어나기</span>
          </div>
        </div>
        <button
          aria-controls="sleep-goal-time-editor"
          aria-expanded={isEditing}
          className={styles.goalEditButton}
          onClick={() => setIsEditing((value) => !value)}
          type="button"
        >
          {isEditing ? "시간 적용" : "시간 수정"}
        </button>
      </section>
      {isEditing ? (
        <fieldset className={styles.goalTimeEditor} id="sleep-goal-time-editor">
          <legend>목표 수면 시간 수정</legend>
          <label>
            취침 시간
            <input
              aria-label="취침 시간"
              lang="en-GB"
              onChange={(event) => setTargetBedTime(event.target.value)}
              required
              type="time"
              value={targetBedTime}
            />
          </label>
          <label>
            기상 시간
            <input
              aria-label="기상 시간"
              lang="en-GB"
              onChange={(event) => setTargetWakeTime(event.target.value)}
              required
              type="time"
              value={targetWakeTime}
            />
          </label>
        </fieldset>
      ) : null}
    </>
  );
};
