import Link from "next/link";
import type { DisplayState } from "@/shared/domain/contracts";
import type {
  ReadinessViewModel,
  RegionViewModel,
} from "@/modules/analysis/application/get-today-view-model";
import styles from "./today.module.css";

type ReadinessCardProps = Readonly<{
  viewModel: RegionViewModel<ReadinessViewModel>;
}>;

const stateClassName: Record<DisplayState, string> = {
  ready: styles.regionReady,
  insufficient: styles.regionInsufficient,
  stale: styles.regionStale,
  error: styles.regionError,
};

const stateLabel: Record<DisplayState, string> = {
  ready: "분석 가능",
  insufficient: "분석 필요",
  stale: "최근 정상값 재사용",
  error: "재계산 필요",
};

const Score = ({ value, label }: Readonly<{ value: number; label: string }>) => (
  <div className={styles.scoreRow}>
    <span className={styles.scoreValue}>{value}점</span>
    <span className={styles.scoreLabel}>{label}</span>
    <progress max={100} value={value} className={styles.progressBar} />
  </div>
);

export const ReadinessCard = ({ viewModel }: ReadinessCardProps) => {
  const score = viewModel.data?.score;
  const scoreText = score === null || score === undefined || !Number.isFinite(score)
    ? "점수 산출 불가"
    : `${score}점`;
  const hasNumericScore = viewModel.data !== null && viewModel.data.score !== null && Number.isFinite(viewModel.data.score);

  return (
    <section className={`${styles.regionCard} ${stateClassName[viewModel.state]}`} aria-live="polite">
      <h2 className={styles.regionTitle}>오늘의 수면 준비도</h2>
      <p className={styles.regionBadge}>{stateLabel[viewModel.state]}</p>

      {viewModel.data === null ? (
        <p className={styles.regionMessage}>{viewModel.message ?? "데이터가 없습니다"}</p>
      ) : (
        <>
          <p className={styles.scoreText}>{scoreText}</p>
          <p className={styles.regionMessage}>{viewModel.data.label}</p>
          {hasNumericScore ? <Score value={viewModel.data.score} label={viewModel.data.label} /> : (
            <p className={styles.noScoreNote}>수치가 충분하지 않아 점수는 표시하지 않습니다.</p>
          )}
        </>
      )}

      {viewModel.message && viewModel.data !== null ? (
        <p className={styles.regionMessage}>{viewModel.message}</p>
      ) : null}

      {viewModel.action ? (
        <Link href={viewModel.action.href} className={styles.linkButton}>
          {viewModel.action.label}
        </Link>
      ) : null}
    </section>
  );
};
