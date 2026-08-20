"use client";

import Image from "next/image";
import { useActionState } from "react";
import { ScheduleAdviceCard } from "@/modules/planner/ui/schedule-advice-card";
import { retryNarrationAction, type NarrationRetryActionState } from "@/app/(app)/analyze/actions";
import type { AnalyzeViewModel, ReportViewModel } from "../application/get-analyze-view-model";
import { CaffeineProfile } from "./caffeine-profile";
import { DataBasisPanel } from "./data-basis-panel";
import { ExplainabilityCard } from "./explainability-card";
import { MetricGrid } from "./metric-grid";
import { SleepTrendChart } from "./sleep-trend-chart";
import { FigmaMobileHeader } from "@/shared/ui/figma-mobile-header";
import styles from "./analyze.module.css";

const initialRetryState: NarrationRetryActionState = { status: "idle" };

const analysisStateText = (state: AnalyzeViewModel["state"]) => (
  state === "ready" ? "분석 완료" : state === "stale" ? "이전 분석 표시" : "기록을 기다리는 중"
);

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
      <p className={`${styles.eyebrow} ${styles.desktopReportEyebrow}`}>분석 리포트</p>
      <p aria-hidden="true" className={`${styles.eyebrow} ${styles.mobileReportEyebrow}`}>AI 분석 리포트</p>
      <h2 id="analysis-report-title">{report.headline}</h2>
      <p>{report.body}</p>
      <span aria-hidden="true" className={styles.reportBasis}>계산 결과 기반</span>
      <ul>{report.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
      {narration?.retryAvailable ? (
        <form action={retryAction} aria-busy={retryPending}>
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
  <main data-lunar-screen="analyze" className={styles.page}>
    <FigmaMobileHeader title="최근 14일 분석" subtitle="계산 결과와 AI 설명을 함께 확인해요." />
    <span aria-hidden="true" className={`${styles.mobileAnalysisState} ${styles[`status_${viewModel.state}`]}`}>
      <span>●</span> {analysisStateText(viewModel.state)}
    </span>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>ANALYZE · 최근 14일</p>
      <h1>
        <span aria-hidden="true" className={styles.desktopHeroTitle}>내 몸의 리듬을<br />생활 기록으로 이해해요</span>
        <span className={styles.semanticHeroTitle}>분석</span>
      </h1>
      <p>계산된 패턴을 바탕으로 AI가 이해하기 쉬운 관리 방법을 정리합니다.</p>
      <span className={styles[`status_${viewModel.state}`]}><span aria-hidden="true">●</span> {analysisStateText(viewModel.state)}</span>
    </header>
    <div className={styles.primaryLayout}>
      <MetricGrid metrics={viewModel.metrics} variant="mobile-summary" />
      <AnalysisReport narration={viewModel.narration} report={viewModel.report} />
    </div>
    <aside aria-hidden="true" className={styles.mobileExplainabilityVisual}>
      <Image alt="" height={92} src="/assets/lunar-rabbit/rabbit-face.png" width={92} />
      <strong>왜 이런 제안인가요?</strong>
      <p>수면·카페인·휴대폰·식사·일정 기록을 계산하고, AI가 알기 쉽게 설명합니다.</p>
    </aside>
    {viewModel.scheduleAdvice ? (
      <div className={styles.scheduleAdviceSlot}>
        <ScheduleAdviceCard advice={viewModel.scheduleAdvice} timezone={viewModel.scheduleAdvice.timezone} />
      </div>
    ) : null}
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
