import Image from "next/image";
import Link from "next/link";
import type { DisplayState } from "@/shared/domain/contracts";
import type { TodayViewModel } from "@/modules/analysis/application/get-today-view-model";
import { DataStatusCard } from "./data-status-card";
import { PreparationTimeline } from "./preparation-timeline";
import { ReadinessCard } from "./readiness-card";
import { RecordStatusSummary } from "./record-status-summary";
import styles from "./today.module.css";

type TodayScreenProps = Readonly<{
  viewModel: TodayViewModel;
}>;

const stateClassName: Record<DisplayState, string> = {
  ready: styles.pageReady,
  insufficient: styles.pageInsufficient,
  stale: styles.pageStale,
  error: styles.pageError,
};

const targetBedTime = (message: string | null): string | null => {
  const matched = message?.match(/\b([0-2]\d:[0-5]\d)\b/);
  return matched?.[1] ?? null;
};

const formatLocalDate = (localDate: string): string => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!matched) {
    return localDate;
  }

  const [, year, month, day] = matched;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
};

export const TodayScreen = ({ viewModel }: TodayScreenProps) => {
  const goalTime = targetBedTime(viewModel.preparationTimeline.message);
  const visualTitle = goalTime ? `오늘 밤 ${goalTime}을 위한 준비` : "오늘 밤을 위한 준비";
  const localDateLabel = formatLocalDate(viewModel.localDate);

  return (
    <main data-lunar-screen="today" className={`${styles.todayPage} ${stateClassName[viewModel.readiness.state]}`}>
      <div aria-hidden="true" className={styles.mobileHeader}>
        <Image
          alt=""
          className={styles.headerArtwork}
          height={154}
          priority
          src="/assets/lunar-rabbit/today-mobile-header.svg"
          width={390}
        />
        <div className={styles.mobileHeaderCopy}>
          <p className={styles.mobileBrand}>SLEEP LOOP</p>
          <p className={styles.mobileTitle}>{visualTitle}</p>
          <p className={styles.mobileSubtitle}>식사 시간부터 휴대폰 마무리까지 한 화면에서 확인해요.</p>
        </div>
      </div>

      <header className={styles.todayHeader}>
        <Image
          alt=""
          className={styles.desktopHeaderArtwork}
          fill
          priority
          sizes="(max-width: 767px) 100vw, min(1220px, calc(100vw - 220px))"
          src="/assets/lunar-rabbit/today-desktop-header.svg"
        />
        <div className={styles.headerCopy}>
          <p className={styles.localDate}>TODAY&nbsp;&nbsp;·&nbsp;&nbsp;{localDateLabel}</p>
          <h1 className={styles.title}>
            {goalTime ? <>오늘 밤, {goalTime}에<br />편안히 잠들기 위한 준비</> : <>오늘 밤,<br />편안히 잠들기 위한 준비</>}
          </h1>
          <p className={styles.headerSubtitle}>식사·카페인·운동·휴대폰 사용을 흐름으로 정리해드려요.</p>
        </div>
        <Link className={styles.headerAction} href="/record">오늘 기록하기</Link>
      </header>

      <div className={styles.todayBody}>
        <section aria-label="오늘 상태" className={styles.overviewGrid}>
          <ReadinessCard viewModel={viewModel.readiness} />
          <DataStatusCard viewModel={viewModel.dataStatus} />
        </section>

        <section aria-label="오늘 준비와 기록" className={styles.contentGrid}>
          <PreparationTimeline viewModel={viewModel.preparationTimeline} hasRerouteAdvice={viewModel.hasRerouteAdvice} />
          <aside className={styles.mobileInputHint}>
            <strong>수면 입력은 어젯밤 기준</strong>
            <p>기상 후 직접 기록하면 오늘 분석에 반영돼요.</p>
            <Link href="/record/sleep-phone?step=sleep">수면 기록하기</Link>
          </aside>
          <RecordStatusSummary viewModel={viewModel.recordSummary} />
        </section>

        <aside className={styles.logicNote}>
          <strong>안내 방식</strong>
          <p>준비도와 시간 제안은 기록·목표·일정을 바탕으로 계산합니다. 의학적 진단이 아닌 일상 루틴 지원 정보입니다.</p>
        </aside>
      </div>
    </main>
  );
};
