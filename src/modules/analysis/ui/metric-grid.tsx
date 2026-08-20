import type { MetricViewModel } from "../application/get-analyze-view-model";
import styles from "./analyze.module.css";

const statusText = (state: MetricViewModel["state"]) =>
  state === "ready" ? "확인됨" : state === "stale" ? "이전 기록" : "초기 추정";

const mobileMetricLabel: Partial<Record<MetricViewModel["key"], string>> = {
  "sleep-goal": "목표 수면",
  "caffeine-signal": "카페인 신호",
};

export const MetricGrid = ({ metrics }: { metrics: readonly MetricViewModel[] }) => {
  return (
    <section aria-labelledby="analysis-metrics-title" className={styles.metricSection}>
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>패턴 지표</p>
        <h2 id="analysis-metrics-title">지금의 수면 리듬</h2>
      </div>
      <div className={styles.metricGrid}>
        {metrics.map((metric) => (
          <article
          className={styles.metricCard}
          data-metric-key={metric.key}
          key={metric.key}
        >
          <p>
            <span className={styles.metricDesktopLabel}>{metric.label}</span>
            <span className={styles.metricMobileLabel}>{mobileMetricLabel[metric.key] ?? metric.label}</span>
          </p>
          <strong>{metric.value === null ? "기록 필요" : `${metric.value}점`}</strong>
          <span className={styles[`status_${metric.state}`]}>
            <span aria-hidden="true">●</span> {statusText(metric.state)}
          </span>
        </article>
        ))}
      </div>
    </section>
  );
};
