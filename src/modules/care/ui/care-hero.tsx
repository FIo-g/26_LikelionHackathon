import type { PlanDayTarget } from "@/modules/planner/domain/types";
import styles from "./care.module.css";

const formatTime = (value: string, timezone: string): string => new Intl.DateTimeFormat("ko-KR", {
  timeZone: timezone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(value));

const timeUntil = (value: string): string => {
  const minutes = Math.max(0, Math.round((new Date(value).getTime() - Date.now()) / 60_000));
  if (minutes < 60) return `${minutes}분`;

  return `${Math.ceil(minutes / 60)}시간`;
};

type CareHeroProps = Readonly<{
  planDay: PlanDayTarget | null;
  routineCount: number;
  timezone: string;
}>;

export const CareHero = ({ planDay, routineCount, timezone }: CareHeroProps) => (
  <section className={styles.hero} aria-labelledby="care-hero-title">
    <div className={styles.heroCopy}>
      <p className={styles.heroMeta}>
        {planDay ? (
          <>
            취침 목표 <time dateTime={planDay.targetBedAt}>{formatTime(planDay.targetBedAt, timezone)}</time>
            {" · "}오늘 루틴 {routineCount}단계
          </>
        ) : "수면 목표 입력 후 맞춤 루틴을 만들어요"}
      </p>
      <h2 aria-label="오늘 밤 수면 준비" className={styles.heroTitle} id="care-hero-title">
        <span className={styles.heroDesktopTitle}>천천히 화면을 내려놓고<br aria-hidden="true" /> 잠으로 가요.</span>
        <span className={styles.heroMobileTitle}>지금은 하나만<br aria-hidden="true" /> 천천히 해볼까요?</span>
      </h2>
      <p className={styles.heroDescription}>
        {planDay
          ? "오늘 밤을 위한 작은 준비를 순서대로 마치며 편안하게 하루를 닫아보세요."
          : "수면 목표를 입력하면 오늘 밤에 맞춘 준비 루틴을 만들어요."}
      </p>
    </div>

    {planDay ? (
      <dl className={styles.heroSchedule} aria-label="오늘의 목표 시간">
        <div className={styles.heroScheduleItem}>
          <dt>목표 취침까지</dt>
          <dd><time dateTime={planDay.targetBedAt}>{timeUntil(planDay.targetBedAt)}</time></dd>
        </div>
      </dl>
    ) : (
      <p className={styles.heroEmpty}>수면 목표 입력이 필요해요</p>
    )}
  </section>
);
