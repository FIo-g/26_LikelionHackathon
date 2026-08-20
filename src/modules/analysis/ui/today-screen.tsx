import type { DisplayState } from "@/shared/domain/contracts";
import type { TodayViewModel } from "@/modules/analysis/application/get-today-view-model";
import { DataStatusCard } from "./data-status-card";
import { PreparationTimeline } from "./preparation-timeline";
import { ReadinessCard } from "./readiness-card";
import { RecordStatusSummary } from "./record-status-summary";
import { FigmaMobileHeader } from "@/shared/ui/figma-mobile-header";
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

export const TodayScreen = ({ viewModel }: TodayScreenProps) => {
  const goalTime = targetBedTime(viewModel.preparationTimeline.message);
  const visualTitle = goalTime ? `오늘 밤 ${goalTime}을 위한 준비` : "오늘 밤을 위한 준비";

  return (
  <main data-lunar-screen="today" className={`${styles.todayPage} ${stateClassName[viewModel.readiness.state]}`}>
    <FigmaMobileHeader
      title={visualTitle}
      subtitle="식사 시간부터 휴대폰 마무리까지 한 화면에서 확인해요."
    />
    <header className={styles.todayHeader}>
      <h1 className={styles.title}>오늘</h1>
      <p className={styles.localDate}>기준 날짜: {viewModel.localDate}</p>
    </header>

    <section className={styles.regionGrid}>
      <ReadinessCard viewModel={viewModel.readiness} />
      <DataStatusCard viewModel={viewModel.dataStatus} />
      <PreparationTimeline viewModel={viewModel.preparationTimeline} hasRerouteAdvice={viewModel.hasRerouteAdvice} />
      <aside className={styles.mobileInputHint}>
        <strong>수면 입력은 어젯밤 기준</strong>
        <p>워치가 없으면 기상 후 직접 기록해요.</p>
      </aside>
      <RecordStatusSummary viewModel={viewModel.recordSummary} />
    </section>
  </main>
  );
};
