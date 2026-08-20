import type { PlanDayTarget } from "../domain/types";
import { formatPlanTime } from "./format-plan-time";
import styles from "./plan.module.css";

export const NearbyDayAdvice = ({ days, timezone }: { days: readonly PlanDayTarget[]; timezone: string }) => (
  <section className={styles.nearbyAgenda} aria-labelledby="nearby-day-advice-title">
    <p className={styles.eyebrow}>모바일 일정</p>
    <h2 id="nearby-day-advice-title">가까운 수면 일정</h2>
    <ol>
      {days.slice(0, 3).map((day) => (
        <li key={day.localDate}>
          <time dateTime={day.localDate}>{day.localDate}</time>
          <span>취침 {formatPlanTime(day.targetBedAt, timezone)} · 기상 {formatPlanTime(day.targetWakeAt, timezone)}</span>
        </li>
      ))}
    </ol>
  </section>
);
