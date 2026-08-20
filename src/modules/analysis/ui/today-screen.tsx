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

export const TodayScreen = ({ viewModel }: TodayScreenProps) => (
  <main className={`${styles.todayPage} ${stateClassName[viewModel.readiness.state]}`}>
    <header className={styles.todayHeader}>
      <h1 className={styles.title}>오늘</h1>
      <p className={styles.localDate}>기준 날짜: {viewModel.localDate}</p>
    </header>

    <section className={styles.regionGrid}>
      <ReadinessCard viewModel={viewModel.readiness} />
      <DataStatusCard viewModel={viewModel.dataStatus} />
      <PreparationTimeline viewModel={viewModel.preparationTimeline} hasRerouteAdvice={viewModel.hasRerouteAdvice} />
      <RecordStatusSummary viewModel={viewModel.recordSummary} />
    </section>
  </main>
);
