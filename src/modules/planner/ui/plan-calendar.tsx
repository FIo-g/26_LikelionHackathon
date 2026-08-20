import styles from "./plan.module.css";

type EventSummary = Readonly<{ id: string; type: string; startsAt: string }>;

const weekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;

const formatEvent = (startsAt: string, timezone: string): string => new Intl.DateTimeFormat("ko-KR", {
  timeZone: timezone,
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(startsAt));

const localDate = (startsAt: string, timezone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(startsAt));
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    return `${value("year")}-${value("month")}-${value("day")}`;
  } catch {
    return "";
  }
};

const monthCells = (anchorLocalDate: string): readonly (string | null)[] => {
  const [year, month] = anchorLocalDate.split("-").map(Number);
  if (!year || !month) return [];
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [
    ...Array.from<null>({ length: firstWeekday }).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`),
  ];
};

const monthTitle = (anchorLocalDate: string): string => {
  const [year, month] = anchorLocalDate.split("-").map(Number);
  return year && month ? `${year}년 ${month}월` : "일정 캘린더";
};

export const PlanCalendar = ({
  events,
  timezone,
  anchorLocalDate,
}: {
  events: readonly EventSummary[];
  timezone: string;
  anchorLocalDate: string;
}) => {
  const cells = monthCells(anchorLocalDate);
  const anchorMonth = anchorLocalDate.slice(0, 7);
  const eventsByDate = new Map<string, EventSummary[]>();
  for (const event of events) {
    const date = localDate(event.startsAt, timezone);
    const current = eventsByDate.get(date) ?? [];
    current.push(event);
    eventsByDate.set(date, current);
  }
  const outsideMonth = events.filter((event) => localDate(event.startsAt, timezone).slice(0, 7) !== anchorMonth);

  return (
    <section className={styles.calendarCard} aria-labelledby="plan-calendar-title">
      <div className={styles.calendarHeading}>
        <div>
          <p className={styles.eyebrow}>다가오는 일정</p>
          <h2 id="plan-calendar-title">{monthTitle(anchorLocalDate)}</h2>
        </div>
        <span>{events.length}개 일정</span>
      </div>

      <div className={styles.calendarWeekdays} aria-hidden="true">
        {weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <ol className={styles.calendarGrid} aria-label={`${monthTitle(anchorLocalDate)} 월간 일정`}>
        {cells.map((date, index) => date ? (
          <li key={date} className={styles.calendarCell}>
            <time dateTime={date}>{Number(date.slice(-2))}</time>
            {(eventsByDate.get(date) ?? []).map((event) => (
              <span className={styles.calendarEvent} key={event.id} title={`${event.type} · ${formatEvent(event.startsAt, timezone)}`}>
                <i aria-hidden="true" />
                <span>{event.type}</span>
              </span>
            ))}
          </li>
        ) : <li aria-hidden="true" className={styles.calendarBlank} key={`blank-${index}`} />)}
      </ol>

      {outsideMonth.length > 0 ? (
        <div className={styles.outsideMonthEvents}>
          <h3>다른 달 일정</h3>
          <ol>
            {outsideMonth.map((event) => (
              <li key={event.id}>
                <strong>{event.type}</strong>
                <time dateTime={event.startsAt}>{formatEvent(event.startsAt, timezone)}</time>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {events.length === 0 ? <p className={styles.emptyCopy}>입력한 주요 일정이 아직 없어요.</p> : null}
      <div className={styles.calendarLegend} aria-hidden="true"><span>주요 일정</span><span>일정 시간은 내 시간대 기준</span></div>
    </section>
  );
};
