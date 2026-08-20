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

const confidenceLabel: Readonly<Record<ReadinessViewModel["confidence"], string>> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
  insufficient: "산출 불가",
};

const Score = ({ value }: Readonly<{ value: number }>) => (
  <div className={styles.scoreRow}>
    <p className={styles.scoreText}>
      <span>{value}</span>
      <small>/ 100</small>
    </p>
    <progress aria-label={`수면 준비도 ${value}점`} max={100} value={value} className={styles.progressBar} />
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
          {hasNumericScore ? <Score value={viewModel.data.score} /> : (
            <p className={styles.noScoreNote}>수치가 충분하지 않아 점수는 표시하지 않습니다.</p>
          )}
          <p className={styles.readinessInsight}>분석 신뢰도 · {confidenceLabel[viewModel.data.confidence]}</p>
          {!hasNumericScore ? <p className={styles.regionMessage}>{viewModel.data.label || scoreText}</p> : null}
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
