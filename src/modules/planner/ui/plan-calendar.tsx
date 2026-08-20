import styles from "./plan.module.css";

type EventSummary = Readonly<{ id: string; type: string; startsAt: string }>;

const formatEvent = (startsAt: string, timezone: string): string => new Intl.DateTimeFormat("ko-KR", {
  timeZone: timezone,
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(startsAt));

export const PlanCalendar = ({ events, timezone }: { events: readonly EventSummary[]; timezone: string }) => (
  <section className={styles.calendarCard} aria-labelledby="plan-calendar-title">
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.eyebrow}>다가오는 일정</p>
        <h2 id="plan-calendar-title">일정 캘린더</h2>
      </div>
      <span>{events.length}개</span>
    </div>
    {events.length > 0 ? (
      <ol className={styles.eventList}>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.type}</strong>
            <time dateTime={event.startsAt}>{formatEvent(event.startsAt, timezone)}</time>
          </li>
        ))}
      </ol>
    ) : <p className={styles.emptyCopy}>입력한 주요 일정이 아직 없어요.</p>}
  </section>
);
