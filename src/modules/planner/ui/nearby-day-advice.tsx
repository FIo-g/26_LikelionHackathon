import type { PlanDayTarget } from "../domain/types";
import styles from "./plan.module.css";

const timeLabel = (value: string): string => new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export const NearbyDayAdvice = ({ days }: { days: readonly PlanDayTarget[] }) => (
  <section className={styles.nearbyAgenda} aria-labelledby="nearby-day-advice-title">
    <p className={styles.eyebrow}>모바일 일정</p>
    <h2 id="nearby-day-advice-title">가까운 수면 일정</h2>
    <ol>
      {days.slice(0, 3).map((day) => (
        <li key={day.localDate}>
          <time dateTime={day.localDate}>{day.localDate}</time>
          <span>취침 {timeLabel(day.targetBedAt)} · 기상 {timeLabel(day.targetWakeAt)}</span>
        </li>
      ))}
    </ol>
  </section>
);
