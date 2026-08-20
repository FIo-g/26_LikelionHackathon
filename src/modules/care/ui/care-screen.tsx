import Image from "next/image";
import type { CareViewModel } from "../application/get-care-view-model";
import { CareHero } from "./care-hero";
import { CareSignalPanel } from "./care-signal-panel";
import { CareToolGrid } from "./care-tool-grid";
import { RoutineTimeline } from "./routine-timeline";
import { SyncSummary } from "./sync-summary";
import styles from "./care.module.css";

const displayLocalDate = (localDate: string): string => {
  const [rawYear, rawMonth, rawDay] = localDate.split("-").map(Number);
  if (!rawYear || !rawMonth || !rawDay) return localDate;

  const date = new Date(Date.UTC(rawYear, rawMonth - 1, rawDay));
  if (Number.isNaN(date.getTime())) return localDate;

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
    weekday: "long",
  }).formatToParts(date);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const month = valueFor("month");
  const day = valueFor("day");
  const weekday = valueFor("weekday");
  return month && day && weekday ? `${month}월 ${day}일 · ${weekday}` : localDate;
};

export const CareScreen = ({ viewModel }: { viewModel: CareViewModel }) => {
  const localDateLabel = displayLocalDate(viewModel.localDate);

  return (
    <main className={styles.page} data-lunar-screen="care">
      <div aria-hidden="true" className={styles.mobileHeader}>
        <Image
          alt=""
          className={styles.mobileHeaderBackdrop}
          height={104}
          priority
          src="/assets/lunar-rabbit/care-mobile-header.svg"
          width={390}
        />
        <span className={styles.mobileBrandMoon}>토</span>
        <div className={styles.mobileHeaderCopy}>
          <p className={styles.mobileHeaderBrand}>SLEEP LOOP</p>
          <p className={styles.mobileHeaderTitle}>오늘 밤 케어</p>
          <p className={styles.mobileHeaderDate}>{localDateLabel}</p>
        </div>
        <Image
          alt=""
          className={styles.mobileHeaderRabbit}
          height={80}
          src="/assets/lunar-rabbit/care-rabbit.png"
          width={80}
        />
      </div>

      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderCopy}>
          <p className={styles.eyebrow}>CARE / TONIGHT</p>
          <h1>오늘 밤 케어</h1>
          <p><time dateTime={viewModel.localDate}>{localDateLabel}</time></p>
        </div>
      </header>

      <div className={styles.careLayout}>
        <section aria-label="오늘 밤 케어 내용" className={styles.careMain}>
          <CareHero
            planDay={viewModel.planDay}
            routineCount={viewModel.routineSteps.length}
            timezone={viewModel.timezone}
          />
          <RoutineTimeline
            localDate={viewModel.localDate}
            planDayId={viewModel.activePlanDayId}
            routineRevisionKey={viewModel.routineRevisionKey}
            steps={viewModel.routineSteps}
            timezone={viewModel.timezone}
          />
          <CareToolGrid localDate={viewModel.localDate} />
        </section>

        <aside aria-label="실시간 신호" className={styles.signalColumn}>
          <h2 className={styles.signalHeading}>실시간 신호</h2>
          <SyncSummary availability="available" mode="manual" state={viewModel.inputState} />
          <CareSignalPanel
            inputState={viewModel.inputState}
            planDay={viewModel.planDay}
            phonePattern={viewModel.phonePattern}
            rerouteAdvice={viewModel.rerouteAdvice}
            tomorrowPlan={viewModel.tomorrowPlan}
            timezone={viewModel.timezone}
          />
        </aside>
      </div>
    </main>
  );
};
