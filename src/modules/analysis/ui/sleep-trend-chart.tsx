import type { TrendPoint } from "../application/get-analyze-view-model";
import styles from "./analyze.module.css";

const minuteLabel = (minutes: number | null) =>
  minutes === null ? "기록 없음" : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;

export const SleepTrendChart = ({ trend }: { trend: readonly TrendPoint[] }) => {
  const available = trend.filter((point) => point.sleepMinutes !== null);
  const max = Math.max(600, ...available.map((point) => point.sleepMinutes ?? 0), ...trend.map((point) => point.goalMinutes));
  const width = Math.max(280, trend.length * 34);
  const yFor = (minutes: number) => 150 - (minutes / max) * 120;

  return (
    <section aria-labelledby="sleep-trend-title" className={styles.chartSection}>
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>2주 흐름</p>
        <h2 id="sleep-trend-title">수면 시간과 목표</h2>
      </div>
      {trend.length === 0 ? (
        <p className={styles.emptyState}>추세를 그릴 기록을 기다리고 있어요.</p>
      ) : (
        <>
          <svg aria-label="최근 2주 수면 시간과 목표" className={styles.chart} role="img" viewBox={`0 0 ${width} 180`}>
            <line className={styles.chartAxis} x1="0" x2={width} y1="150" y2="150" />
            {trend.map((point, index) => {
              const x = 18 + index * 34;
              const sleep = point.sleepMinutes;
              return (
                <g key={point.localDate}>
                  <line className={styles.goalLine} x1={x - 12} x2={x + 12} y1={yFor(point.goalMinutes)} y2={yFor(point.goalMinutes)} />
                  {sleep === null ? (
                    <text className={styles.missingLabel} x={x} y="165">기록 없음</text>
                  ) : (
                    <g aria-label={`${point.localDate}: 수면 ${minuteLabel(sleep)}, 목표 ${minuteLabel(point.goalMinutes)}`} tabIndex={0}>
                      <title>{`${point.localDate}: 수면 ${minuteLabel(sleep)}, 목표 ${minuteLabel(point.goalMinutes)}`}</title>
                      <circle className={styles.sleepPoint} cx={x} cy={yFor(sleep)} r="5" />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          <table className={styles.srOnlyTable}>
            <caption>수면 시간과 목표 상세</caption>
            <thead><tr><th>날짜</th><th>수면</th><th>목표</th></tr></thead>
            <tbody>
              {trend.map((point) => <tr key={point.localDate}><td>{point.localDate}</td><td>{minuteLabel(point.sleepMinutes)}</td><td>{minuteLabel(point.goalMinutes)}</td></tr>)}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
};
