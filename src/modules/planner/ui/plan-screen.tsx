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
import { FigmaMobileHeader } from "@/shared/ui/figma-mobile-header";
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

const upcomingMobileEvents = (events: PlanViewModel["events"], now = Date.now()) => (
  events.filter((event) => {
    const startsAt = Date.parse(event.startsAt);
    return Number.isFinite(startsAt) && startsAt >= now;
  }).slice(0, 3)
);

export const PlanDesktopContent = ({ viewModel }: { viewModel: PlanViewModel }) => (
  <>
    <CalendarConnectionCard availability={viewModel.calendarConnection.availability} />
    <div className={styles.desktopGrid}><PlanCalendar events={viewModel.events} timezone={viewModel.timezone} /><MajorEventForm /></div>
    {viewModel.advice ? <ScheduleAdviceCard advice={viewModel.advice} timezone={viewModel.timezone} /> : null}
    {!viewModel.advice && viewModel.dismissedAdvice ? <p className={styles.dismissedNotice} role="status">제안을 닫았습니다.</p> : null}
    <TwoWeekPlanStrip days={viewModel.days} planStatus={viewModel.planStatus} timezone={viewModel.timezone} />
  </>
);

export const PlanMobileContent = ({ viewModel }: { viewModel: PlanViewModel }) => {
  const events = upcomingMobileEvents(viewModel.events);

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
                <strong>{event.type || "주요 일정"}</strong>
                <span>{mobileEventTime(event.startsAt, viewModel.timezone)}</span>
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
    <FigmaMobileHeader title="이번 주 수면 계획" subtitle="주요 일정과 기록을 함께 반영해요." />
    <header className={styles.planHeader}><p className={styles.eyebrow}>Adaptive Sleep Planner</p><h1>계획</h1><p>주요 일정을 먼저 확인하고, 수면 계획에 반영할지는 직접 결정하세요.</p></header>
    <PlanResponsiveContent desktop={<PlanDesktopContent viewModel={viewModel} />} mobile={<PlanMobileContent viewModel={viewModel} />} />
  </main>
);
