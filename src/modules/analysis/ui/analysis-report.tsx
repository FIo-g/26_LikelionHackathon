"use client";

import { useActionState } from "react";
import { ScheduleAdviceCard } from "@/modules/planner/ui/schedule-advice-card";
import { retryNarrationAction, type NarrationRetryActionState } from "@/app/(app)/analyze/actions";
import type { AnalyzeViewModel, ReportViewModel } from "../application/get-analyze-view-model";
import { CaffeineProfile } from "./caffeine-profile";
import { DataBasisPanel } from "./data-basis-panel";
import { ExplainabilityCard } from "./explainability-card";
import { MetricGrid } from "./metric-grid";
import { SleepTrendChart } from "./sleep-trend-chart";
import styles from "./analyze.module.css";

const initialRetryState: NarrationRetryActionState = { status: "idle" };

export const AnalysisReport = ({
  report,
  narration,
}: {
  report: ReportViewModel;
  narration?: Readonly<{ id: string; retryAvailable: boolean }> | null;
}) => {
  const [retryState, retryAction, retryPending] = useActionState(retryNarrationAction, initialRetryState);

  return (
    <section aria-labelledby="analysis-report-title" className={styles.reportSection}>
      <p className={styles.eyebrow}>분석 리포트</p>
      <h2 id="analysis-report-title">{report.headline}</h2>
      <p>{report.body}</p>
      <ul>{report.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
      {narration?.retryAvailable ? (
        <form action={retryAction}>
          <input name="narrationId" type="hidden" value={narration.id} />
          <button disabled={retryPending} type="submit">{retryPending ? "다시 준비 중" : "리포트 다시 시도"}</button>
          {retryState.status !== "idle" ? <p aria-live="polite" role={retryState.status === "error" ? "alert" : undefined}>{retryState.message}</p> : null}
        </form>
      ) : null}
      <p className={styles.disclaimer}>초기 추정 모델이며 의료 진단이 아닙니다.</p>
    </section>
  );
};

export const AnalyzeScreen = ({ viewModel }: { viewModel: AnalyzeViewModel }) => (
  <main className={styles.page}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>ANALYZE</p>
      <h1>분석</h1>
      <p>기록에서 보이는 수면 패턴을 차분하게 정리했어요.</p>
      <span className={styles[`status_${viewModel.state}`]}><span aria-hidden="true">●</span> {viewModel.state === "ready" ? "분석 완료" : viewModel.state === "stale" ? "이전 분석 표시" : "기록을 기다리는 중"}</span>
    </header>
    <div className={styles.primaryLayout}>
      <MetricGrid metrics={viewModel.metrics} />
      <AnalysisReport narration={viewModel.narration} report={viewModel.report} />
    </div>
    {viewModel.scheduleAdvice ? <ScheduleAdviceCard advice={viewModel.scheduleAdvice} timezone={viewModel.scheduleAdvice.timezone} /> : null}
    <div className={styles.desktopDetails}>
      <SleepTrendChart trend={viewModel.trend} />
      <CaffeineProfile model={viewModel.caffeineProfile} />
      <ExplainabilityCard evidence={viewModel.explainability} />
      <DataBasisPanel dataBasis={viewModel.dataBasis} />
    </div>
    <details className={styles.mobileDetails}>
      <summary>전체 지표·근거 보기</summary>
      <MetricGrid metrics={viewModel.metrics} />
      <SleepTrendChart trend={viewModel.trend} />
      <CaffeineProfile model={viewModel.caffeineProfile} />
      <ExplainabilityCard evidence={viewModel.explainability} />
      <DataBasisPanel dataBasis={viewModel.dataBasis} />
    </details>
  </main>
);
