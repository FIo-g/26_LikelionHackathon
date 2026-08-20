import type { MetricViewModel } from "../application/get-analyze-view-model";
import styles from "./analyze.module.css";

const statusText = (state: MetricViewModel["state"]) =>
  state === "ready" ? "확인됨" : state === "stale" ? "이전 기록" : "초기 추정";

export const MetricGrid = ({ metrics }: { metrics: readonly MetricViewModel[] }) => (
  <section aria-labelledby="analysis-metrics-title" className={styles.metricSection}>
    <div className={styles.sectionHeading}>
      <p className={styles.eyebrow}>패턴 지표</p>
      <h2 id="analysis-metrics-title">지금의 수면 리듬</h2>
    </div>
    <div className={styles.metricGrid}>
      {metrics.map((metric, index) => (
        <article
          className={index > 1 ? styles.priorityDetail : styles.metricCard}
          key={metric.key}
        >
          <p>{metric.label}</p>
          <strong>{metric.value === null ? "기록 필요" : `${metric.value}점`}</strong>
          <span className={styles[`status_${metric.state}`]}>
            <span aria-hidden="true">●</span> {statusText(metric.state)}
          </span>
        </article>
      ))}
    </div>
  </section>
);
