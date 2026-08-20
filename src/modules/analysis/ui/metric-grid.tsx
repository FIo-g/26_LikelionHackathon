import type { MetricViewModel } from "../application/get-analyze-view-model";
import styles from "./analyze.module.css";

const statusText = (state: MetricViewModel["state"]) =>
  state === "ready" ? "확인됨" : state === "stale" ? "이전 기록" : "초기 추정";

const mobileMetricLabel: Partial<Record<MetricViewModel["key"], string>> = {
  "sleep-goal": "목표 수면",
  "caffeine-signal": "카페인 신호",
};

type MetricPresentation = Readonly<{
  tag: string;
  tone: "positive" | "neutral" | "caution" | "muted";
  note: string;
}>;

const presentationFor = (metric: MetricViewModel): MetricPresentation => {
  if (metric.value === null) {
    return {
      tag: "기록 필요",
      tone: "muted",
      note: "기록이 쌓이면 계산해요.",
    };
  }

  if (metric.state === "stale") {
    return {
      tag: "이전 기록",
      tone: "caution",
      note: "가장 최근의 유효한 계산 결과예요.",
    };
  }

  if (metric.state !== "ready") {
    return {
      tag: "초기 추정",
      tone: "muted",
      note: "기록이 더 쌓이면 범위를 다시 계산해요.",
    };
  }

  if (metric.value >= 80) {
    return {
      tag: "높음",
      tone: "positive",
      note: "계산된 점수가 높은 편이에요.",
    };
  }

  if (metric.value >= 60) {
    return {
      tag: "관찰",
      tone: "neutral",
      note: "변화 추이를 계속 살펴봐요.",
    };
  }

  return {
    tag: "낮음",
    tone: "caution",
    note: "기록을 보며 조정해봐요.",
  };
};

type MetricGridProps = Readonly<{
  metrics: readonly MetricViewModel[];
  variant?: "full" | "mobile-summary";
}>;

export const MetricGrid = ({ metrics, variant = "full" }: MetricGridProps) => {
  const headingId = variant === "mobile-summary"
    ? "analysis-summary-metrics-title"
    : "analysis-details-metrics-title";

  return (
    <section
      aria-labelledby={headingId}
      className={`${styles.metricSection} ${variant === "mobile-summary" ? styles.mobileSummaryMetrics : ""}`}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>패턴 지표</p>
        <h2 id={headingId}>지금의 수면 리듬</h2>
      </div>
      <div className={styles.metricGrid}>
        {metrics.map((metric) => {
          const presentation = presentationFor(metric);

          return (
            <article
              className={styles.metricCard}
              data-metric-key={metric.key}
              key={metric.key}
            >
              <div className={styles.metricCardHeader}>
                <p>
                  <span className={styles.metricDesktopLabel}>{metric.label}</span>
                  <span className={styles.metricMobileLabel}>{mobileMetricLabel[metric.key] ?? metric.label}</span>
                </p>
                <span className={`${styles.metricTag} ${styles[`metricTag_${presentation.tone}`]}`}>{presentation.tag}</span>
              </div>
              <strong>{metric.value === null ? "기록 필요" : `${metric.value}점`}</strong>
              <p className={styles.metricNote}>{presentation.note}</p>
              <span className={styles.metricState}>
                <span aria-hidden="true">●</span> {statusText(metric.state)}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
};
