import type { PlanViewModel } from "../application/get-plan-view-model";
import { CalendarConnectionCard } from "./calendar-connection-card";
import { MajorEventForm } from "./major-event-form";
import { NearbyDayAdvice } from "./nearby-day-advice";
import { PlanCalendar } from "./plan-calendar";
import { PlanResponsiveContent } from "./plan-responsive-content";
import { ScheduleAdviceCard } from "./schedule-advice-card";
import { TwoWeekPlanStrip } from "./two-week-plan-strip";
import styles from "./plan.module.css";

export const PlanDesktopContent = ({ viewModel }: { viewModel: PlanViewModel }) => (
  <>
    <CalendarConnectionCard availability={viewModel.calendarConnection.availability} />
    <div className={styles.desktopGrid}><PlanCalendar events={viewModel.events} timezone={viewModel.timezone} /><MajorEventForm /></div>
    {viewModel.advice ? <ScheduleAdviceCard advice={viewModel.advice} timezone={viewModel.timezone} /> : null}
    {!viewModel.advice && viewModel.dismissedAdvice ? <p className={styles.dismissedNotice} role="status">제안을 닫았습니다.</p> : null}
    <TwoWeekPlanStrip days={viewModel.days} planStatus={viewModel.planStatus} timezone={viewModel.timezone} />
  </>
);

export const PlanMobileContent = ({ viewModel }: { viewModel: PlanViewModel }) => (
  <>
    <MajorEventForm />
    <NearbyDayAdvice days={viewModel.days} timezone={viewModel.timezone} />
    {viewModel.advice ? <ScheduleAdviceCard advice={viewModel.advice} timezone={viewModel.timezone} /> : null}
    {!viewModel.advice && viewModel.dismissedAdvice ? <p className={styles.dismissedNotice} role="status">제안을 닫았습니다.</p> : null}
  </>
);

export const PlanScreen = ({ viewModel }: { viewModel: PlanViewModel }) => (
  <main className={styles.planPage}>
    <header className={styles.planHeader}><p className={styles.eyebrow}>Adaptive Sleep Planner</p><h1>계획</h1><p>주요 일정을 먼저 확인하고, 수면 계획에 반영할지는 직접 결정하세요.</p></header>
    <PlanResponsiveContent desktop={<PlanDesktopContent viewModel={viewModel} />} mobile={<PlanMobileContent viewModel={viewModel} />} />
  </main>
);
