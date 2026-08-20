"use client";

import { useState } from "react";

import type { SpecialEventSummary } from "../domain/types";
import styles from "./plan.module.css";

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

const monthKey = (localDate: string): string => localDate.slice(0, 7);

const shiftMonth = (value: string, offset: number): string => {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
};

export const PlanCalendar = ({
  events,
  timezone,
  anchorLocalDate,
  todayLocalDate,
}: {
  events: readonly SpecialEventSummary[];
  timezone: string;
  anchorLocalDate: string;
  todayLocalDate: string;
}) => {
  const [visibleMonth, setVisibleMonth] = useState(() => monthKey(anchorLocalDate));
  const cells = monthCells(`${visibleMonth}-01`);
  const eventsByDate = new Map<string, SpecialEventSummary[]>();
  for (const event of events) {
    const date = localDate(event.startsAt, timezone);
    const current = eventsByDate.get(date) ?? [];
    current.push(event);
    eventsByDate.set(date, current);
  }
  const outsideMonth = events.filter((event) => monthKey(localDate(event.startsAt, timezone)) !== visibleMonth);
  const visibleMonthTitle = monthTitle(`${visibleMonth}-01`);
  const isCurrentMonth = visibleMonth === monthKey(todayLocalDate);

  return (
    <section className={styles.calendarCard} aria-labelledby="plan-calendar-title">
      <div className={styles.calendarHeading}>
        <div>
          <p className={styles.eyebrow}>다가오는 일정</p>
          <h2 id="plan-calendar-title" aria-live="polite">{visibleMonthTitle}</h2>
        </div>
        <div className={styles.calendarControls} aria-label="월 이동">
          <button type="button" aria-label="이전 달" onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}>‹</button>
          <button type="button" aria-label="이번 달" disabled={isCurrentMonth} onClick={() => setVisibleMonth(monthKey(todayLocalDate))}>이번 달</button>
          <button type="button" aria-label="다음 달" onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}>›</button>
        </div>
        <span>{events.length}개 일정</span>
      </div>

      <div className={styles.calendarWeekdays} aria-hidden="true">
        {weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <ol className={styles.calendarGrid} aria-label={`${visibleMonthTitle} 월간 일정`}>
        {cells.map((date, index) => date ? (
          <li key={date} className={`${styles.calendarCell}${date === todayLocalDate ? ` ${styles.calendarToday}` : ""}`}>
            <time aria-current={date === todayLocalDate ? "date" : undefined} dateTime={date}>{Number(date.slice(-2))}</time>
            {(eventsByDate.get(date) ?? []).map((event) => (
              <span className={styles.calendarEvent} key={event.id} title={`${event.title} · ${event.type} · ${formatEvent(event.startsAt, timezone)}`}>
                <i aria-hidden="true" />
                <span className={styles.calendarEventTitle}>{event.title}</span>
                <span className={styles.calendarEventType}>{event.type}</span>
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
                <strong>{event.title}</strong>
                <span>{event.type}</span>
                <time dateTime={event.startsAt}>{formatEvent(event.startsAt, timezone)}</time>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {events.length === 0 ? <p className={styles.emptyCopy}>입력한 주요 일정이 아직 없어요.</p> : null}
      <div className={styles.calendarLegend} aria-label="일정 범례">
        <span>보라색 표시는 직접 입력한 주요 일정</span>
        <span>일정 시간은 내 시간대 기준</span>
      </div>
    </section>
  );
};
