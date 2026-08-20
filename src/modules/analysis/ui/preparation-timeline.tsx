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
    <section className={`${styles.regionCard} ${stateClassName[viewModel.state]}`}>
      <h2 className={styles.regionTitle}>오늘 준비 타임라인</h2>

      {viewModel.message ? <p className={styles.regionMessage}>{viewModel.message}</p> : null}
      {hasRerouteAdvice ? <Link href="/plan">계획 조정 제안 있음</Link> : null}

      {viewModel.data === null ? (
        <p className={styles.regionMessage}>{viewModel.message ?? "준비 타임라인을 계산할 수 없습니다"}</p>
      ) : (
        <ol className={styles.timelineList} aria-label="준비 타임라인">
          {viewModel.data.map((step) => (
            <li key={step.key} className={styles.timelineItem}>
              <p className={styles.timelineStepLabel}>
                {step.label}
                <span className={styles.timelineStatus}>{statusLabel[step.status]}</span>
              </p>
              <p className={styles.timelineTime}>목표 시각 {step.scheduledAt}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
