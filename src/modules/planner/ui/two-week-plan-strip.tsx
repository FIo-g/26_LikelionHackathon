import type { PlanDayTarget } from "../domain/types";
import styles from "./plan.module.css";

const timeLabel = (value: string): string => new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export const TwoWeekPlanStrip = ({ days, planStatus }: { days: readonly PlanDayTarget[]; planStatus: "active" | "none" }) => (
  <section className={styles.stripCard} aria-labelledby="two-week-plan-title" data-testid="plan-strip">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>수면 목표</p><h2 id="two-week-plan-title">{planStatus === "active" ? "반영된 수면 계획" : "앞으로 2주"}</h2></div><span>{planStatus === "active" ? "반영됨" : "읽기 전용"}</span></div>
    {days.length > 0 ? <ol className={styles.dayStrip}>{days.map((day) => <li key={day.localDate} data-testid="plan-day" data-local-date={day.localDate} data-bed-at={day.targetBedAt} data-cutoff-at={day.caffeineCutoffAt} data-wake-at={day.targetWakeAt}><time dateTime={day.localDate}>{day.localDate.slice(5).replace("-", "/")}</time><strong>취침 {timeLabel(day.targetBedAt)}</strong><span>기상 {timeLabel(day.targetWakeAt)}</span></li>)}</ol> : <p className={styles.emptyCopy}>수면 목표를 불러오면 2주 목표가 표시돼요.</p>}
  </section>
);
