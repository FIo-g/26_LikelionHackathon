import Image from "next/image";
import type { PlanViewModel } from "../application/get-plan-view-model";
import { CalendarConnectionCard } from "./calendar-connection-card";
import { MajorEventForm } from "./major-event-form";
import { NearbyDayAdvice } from "./nearby-day-advice";
import { PlanCalendar } from "./plan-calendar";
import { PlanResponsiveContent } from "./plan-responsive-content";
import { ScheduleAdviceCard } from "./schedule-advice-card";
import { TwoWeekPlanStrip } from "./two-week-plan-strip";
import { formatPlanTime } from "./format-plan-time";
import styles from "./plan.module.css";

const weekday = new Map([
  ["Sun", "일"],
  ["Mon", "월"],
  ["Tue", "화"],
  ["Wed", "수"],
  ["Thu", "목"],
  ["Fri", "금"],
  ["Sat", "토"],
]);

const mobileEventDate = (value: string, timezone: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "일정 날짜 확인 필요";

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
      timeZone: timezone,
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
    const month = part("month");
    const day = part("day");
    const dayOfWeek = weekday.get(part("weekday") ?? "");
    return month && day ? `${month}/${day}${dayOfWeek ? ` ${dayOfWeek}` : ""}` : "일정 날짜 확인 필요";
  } catch {
    return "일정 날짜 확인 필요";
  }
};

const mobileEventTime = (value: string, timezone: string): string => {
  try {
    return `${formatPlanTime(value, timezone)} 시작`;
  } catch {
    return "시작 시간 확인 필요";
  }
};

const upcomingEvents = (events: PlanViewModel["events"], now = Date.now()) => (
  events.filter((event) => {
    const startsAt = Date.parse(event.startsAt);
    return Number.isFinite(startsAt) && startsAt >= now;
  }).sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
);

const eventLocalDate = (value: string, timezone: string): string | null => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
    const year = part("year");
    const month = part("month");
    const day = part("day");
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null;
  }
};

const planAnchorDate = (viewModel: PlanViewModel): string => (
  viewModel.days[0]?.localDate
  ?? eventLocalDate(viewModel.events[0]?.startsAt ?? "", viewModel.timezone)
  ?? eventLocalDate(new Date().toISOString(), viewModel.timezone)
  ?? new Date().toISOString().slice(0, 10)
);

const compactDate = (localDate: string): string => {
  const [, month, day] = localDate.split("-").map(Number);
  return month && day ? `${month}월 ${day}일` : localDate;
};

const planRange = (viewModel: PlanViewModel): string => {
  const first = viewModel.days[0]?.localDate ?? planAnchorDate(viewModel);
  const last = viewModel.days[Math.min(6, Math.max(0, viewModel.days.length - 1))]?.localDate ?? first;
  return `${compactDate(first)} ~ ${compactDate(last)}`;
};

export const PlanDesktopContent = ({ viewModel }: { viewModel: PlanViewModel }) => {
  const anchorLocalDate = planAnchorDate(viewModel);
  const todayLocalDate = eventLocalDate(new Date().toISOString(), viewModel.timezone) ?? anchorLocalDate;
  const events = upcomingEvents(viewModel.events);

  return (
    <>
      <CalendarConnectionCard availability={viewModel.calendarConnection.availability} />
      <div className={styles.desktopGrid}>
        <PlanCalendar events={events} timezone={viewModel.timezone} anchorLocalDate={anchorLocalDate} todayLocalDate={todayLocalDate} />
        <aside className={styles.desktopRail} aria-label="일정 입력과 조정 제안">
          <MajorEventForm />
          {viewModel.advice ? <ScheduleAdviceCard advice={viewModel.advice} timezone={viewModel.timezone} /> : null}
          {!viewModel.advice && viewModel.dismissedAdvice ? <p className={styles.dismissedNotice} role="status">제안을 닫았습니다.</p> : null}
        </aside>
      </div>
      <TwoWeekPlanStrip days={viewModel.days} planStatus={viewModel.planStatus} timezone={viewModel.timezone} />
    </>
  );
};

export const PlanMobileContent = ({ viewModel }: { viewModel: PlanViewModel }) => {
  const events = upcomingEvents(viewModel.events);

  return (
    <>
    <section className={styles.mobileConnection} aria-labelledby="mobile-calendar-title">
      <span aria-hidden="true" className={styles.mobileCalendarMark}>캘</span>
      <div>
        <h2 id="mobile-calendar-title">캘린더 연결 · 선택 사항</h2>
        <p>주요 일정은 직접 입력으로도 반영할 수 있어요.</p>
      </div>
      <span className={styles.mobileConnectionStatus}>준비 중</span>
    </section>

    <section className={styles.mobileAgenda} aria-labelledby="mobile-agenda-title">
      <h2 id="mobile-agenda-title">주요 일정</h2>
      {events.length === 0 ? (
        <p className={styles.mobileEmptyAgenda}>예정된 주요 일정이 없어요. 아래에서 직접 추가해보세요.</p>
      ) : (
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              <span aria-hidden="true" className={styles.mobileEventDot} />
              <time dateTime={event.startsAt}>{mobileEventDate(event.startsAt, viewModel.timezone)}</time>
              <div>
                <strong>{event.title}</strong>
                <span className={styles.mobileEventType}>{event.type || "주요 일정"}</span>
                <span className={styles.mobileEventTime}>{mobileEventTime(event.startsAt, viewModel.timezone)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>

    <aside className={styles.mobileAiCard}>
      <Image alt="" height={94} src="/assets/lunar-rabbit/rabbit-face.png" width={94} />
      <h2>AI가 일정에 지장 없게 조정해요</h2>
      <p>기록을 바탕으로 수면·카페인·식사 리듬을 추천해요.</p>
    </aside>

    <a className={styles.mobileAddButton} href="#mobile-major-event-form">＋ 주요 일정 추가</a>
    <MajorEventForm formId="mobile-major-event-form" titleId="mobile-major-event-title" />
    <NearbyDayAdvice days={viewModel.days} timezone={viewModel.timezone} />
    {viewModel.advice ? <ScheduleAdviceCard advice={viewModel.advice} timezone={viewModel.timezone} /> : null}
    {!viewModel.advice && viewModel.dismissedAdvice ? <p className={styles.dismissedNotice} role="status">제안을 닫았습니다.</p> : null}
    </>
  );
};

export const PlanScreen = ({ viewModel }: { viewModel: PlanViewModel }) => (
  <main data-lunar-screen="plan" className={styles.planPage}>
    <div aria-hidden="true" className={styles.mobilePlanHeader}>
      <Image alt="" className={styles.mobileHeaderArt} fill priority sizes="100vw" src="/assets/lunar-rabbit/night-header.svg" />
      <div className={styles.mobileHeaderCopy}>
        <p>SLEEP LOOP</p>
        <strong>이번 주 수면 계획</strong>
        <span>주요 일정과 기록을 함께 반영해요.</span>
      </div>
    </div>
    <header className={styles.planHeader}>
      <Image alt="" className={styles.desktopHeaderArt} fill priority sizes="(max-width: 767px) 100vw, 1120px" src="/assets/lunar-rabbit/night-header.svg" />
      <div className={styles.planHeaderCopy}>
        <p className={styles.headerEyebrow}>PLAN · {planRange(viewModel)}</p>
        <h1>일정에 지장 없게<br />수면 리듬을 계획해요</h1>
        <p>기본 캘린더에 주요 일정을 더하고, 기록을 반영한 조정을 받아보세요.</p>
      </div>
      <a href="#major-event-form">＋ 주요 일정 추가</a>
    </header>
    <PlanResponsiveContent desktop={<PlanDesktopContent viewModel={viewModel} />} mobile={<PlanMobileContent viewModel={viewModel} />} />
  </main>
);
