import type { DisplayState } from "@/shared/domain/contracts";
import Link from "next/link";
import type {
  PreparationStepViewModel,
  RegionViewModel,
} from "@/modules/analysis/application/get-today-view-model";
import styles from "./today.module.css";

type PreparationTimelineProps = Readonly<{
  viewModel: RegionViewModel<readonly PreparationStepViewModel[]>;
  hasRerouteAdvice?: boolean;
}>;

const stateClassName: Record<DisplayState, string> = {
  ready: styles.regionReady,
  insufficient: styles.regionInsufficient,
  stale: styles.regionStale,
  error: styles.regionError,
};

const statusLabel: Readonly<Record<PreparationStepViewModel["status"], string>> = {
  done: "완료",
  current: "진행중",
  upcoming: "예정",
};

export const PreparationTimeline = ({ viewModel, hasRerouteAdvice = false }: PreparationTimelineProps) => {
  return (
    <section className={`${styles.regionCard} ${styles.timelineSection} ${stateClassName[viewModel.state]}`}>
      <h2 className={styles.regionTitle}>오늘의 수면 준비 타임라인</h2>
      <p className={styles.timelineDescription}>기록과 목표를 바탕으로 취침까지의 흐름을 보여드려요.</p>

      {viewModel.message && viewModel.data !== null ? <p className={styles.regionMessage}>{viewModel.message}</p> : null}
      {hasRerouteAdvice ? <Link className={styles.rerouteLink} href="/plan">계획 조정 제안 있음</Link> : null}

      {viewModel.data === null ? (
        <p className={styles.regionMessage}>{viewModel.message ?? "준비 타임라인을 계산할 수 없습니다"}</p>
      ) : (
        <ol className={styles.timelineList} aria-label="준비 타임라인">
          {viewModel.data.map((step) => (
            <li key={step.key} className={`${styles.timelineItem} ${styles[`timeline${step.status}`]}`}>
              <time className={styles.timelineClock}>{step.scheduledAt}</time>
              <span aria-hidden="true" className={styles.timelineDot} />
              <div className={styles.timelineCardBody}>
                <p className={styles.timelineStepLabel}>{step.label}</p>
                <p className={styles.timelineTime}>목표 시각 {step.scheduledAt}</p>
                <span className={styles.timelineStatus}>{statusLabel[step.status]}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
