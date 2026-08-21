"use client";

import Image from "next/image";
import { useActionState } from "react";
import { ScheduleAdviceCard } from "@/modules/planner/ui/schedule-advice-card";
import { attemptNarrationAction, retryNarrationAction, type NarrationRetryActionState } from "@/app/(app)/analyze/actions";
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

const hasAiNarration = (report: ReportViewModel) => report.status === "ready";

export const AnalysisReport = ({
  report,
  narration,
  attemptAvailable = false,
}: {
  report: ReportViewModel;
  narration?: Readonly<{ id: string; retryAvailable: boolean }> | null;
  attemptAvailable?: boolean;
}) => {
  const [retryState, retryAction, retryPending] = useActionState(retryNarrationAction, initialRetryState);
  const [attemptState, attemptAction, attemptPending] = useActionState(attemptNarrationAction, initialRetryState);
  const isAiNarration = hasAiNarration(report);
  const reportLabel = isAiNarration ? "AI 분석 리포트" : "분석 리포트";
  const canAttemptNarration = attemptAvailable && narration === null && report.status === "template-fallback";
  const retryNarrationId = narration?.retryAvailable
    ? narration.id
    : attemptState.status === "fallback"
      ? attemptState.narrationId
      : undefined;

  return (
    <section aria-labelledby="analysis-report-title" className={styles.reportSection}>
      <p className={`${styles.eyebrow} ${styles.reportEyebrow}`}>{reportLabel}</p>
      <h2 id="analysis-report-title">{report.headline}</h2>
      <p>{report.body}</p>
      {isAiNarration ? <span className={styles.reportAiSource}>AI 서술</span> : null}
      <span aria-hidden="true" className={styles.reportBasis}>계산 결과 기반</span>
      <ul>{report.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
      {attemptState.status !== "idle" ? (
        <p
          aria-live="polite"
          className={styles.retryMessage}
          data-status={attemptState.status}
          role={attemptState.status === "error" ? "alert" : undefined}
        >
          {attemptState.message}
        </p>
      ) : null}
      {retryNarrationId ? (
        <form action={retryAction} aria-busy={retryPending} className={styles.retryForm}>
          <input name="narrationId" type="hidden" value={retryNarrationId} />
          <button className={styles.retryButton} disabled={retryPending} type="submit">
            {retryPending ? "다시 준비 중" : "리포트 다시 시도"}
          </button>
          {retryState.status !== "idle" ? (
            <p
              aria-live="polite"
              className={styles.retryMessage}
              data-status={retryState.status}
              role={retryState.status === "error" ? "alert" : undefined}
            >
              {retryState.message}
            </p>
          ) : null}
        </form>
      ) : canAttemptNarration ? (
        <form action={attemptAction} aria-busy={attemptPending} className={styles.retryForm}>
          <button className={styles.retryButton} disabled={attemptPending} type="submit">
            {attemptPending ? "AI 리포트 준비 중" : "AI 리포트 시도"}
          </button>
        </form>
      ) : null}
      <p className={styles.disclaimer}>초기 추정 모델이며 의료 진단이 아닙니다.</p>
    </section>
  );
};

export const AnalyzeScreen = ({ viewModel }: { viewModel: AnalyzeViewModel }) => {
  const isAiNarration = hasAiNarration(viewModel.report);
  const focusDataBasis = () => {
    const dataBasis = document.getElementById("analysis-data-basis");
    if (!dataBasis) return;

    const prefersReducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = prefersReducedMotion ? "auto" : "smooth";
    dataBasis.scrollIntoView({ behavior, block: "start" });
    dataBasis.focus({ preventScroll: true });
  };

  return (
    <main data-lunar-screen="analyze" className={styles.page}>
      <FigmaMobileHeader
        subtitle={isAiNarration ? "계산 결과와 AI 설명을 함께 확인해요." : "계산 결과를 함께 확인해요."}
        title="최근 14일 분석"
      />
      <span aria-hidden="true" className={`${styles.mobileAnalysisState} ${styles[`status_${viewModel.state}`]}`}>
        <span>●</span> {analysisStateText(viewModel.state)}
      </span>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>ANALYZE · 최근 14일</p>
        <h1>
          <span aria-hidden="true" className={styles.desktopHeroTitle}>내 몸의 리듬을<br />생활 기록으로 이해해요</span>
          <span className={styles.semanticHeroTitle}>분석</span>
        </h1>
        <p>{isAiNarration ? "계산된 패턴을 바탕으로 AI가 이해하기 쉬운 관리 방법을 정리합니다." : "계산된 패턴을 바탕으로 이해하기 쉬운 관리 방법을 정리합니다."}</p>
        <button aria-controls="analysis-data-basis" className={styles.dataBasisControl} onClick={focusDataBasis} type="button">
          분석 기준 보기
        </button>
        <span className={`${styles.desktopAnalysisState} ${styles[`status_${viewModel.state}`]}`}><span aria-hidden="true">●</span> {analysisStateText(viewModel.state)}</span>
      </header>
      <div className={styles.primaryLayout}>
        <MetricGrid metrics={viewModel.metrics} variant="mobile-summary" />
        <AnalysisReport
          attemptAvailable={viewModel.state === "ready" && viewModel.narration === null}
          narration={viewModel.narration}
          report={viewModel.report}
        />
      </div>
      <aside aria-hidden="true" className={styles.mobileExplainabilityVisual}>
        <Image alt="" height={92} src="/assets/lunar-rabbit/rabbit-face.png" width={92} />
        <strong>왜 이런 제안인가요?</strong>
        <p>{isAiNarration ? "수면·카페인·휴대폰·식사·일정 기록을 계산하고, AI가 알기 쉽게 설명합니다." : "수면·카페인·휴대폰·식사·일정 기록을 바탕으로 관리 방법을 정리합니다."}</p>
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
        <DataBasisPanel dataBasis={viewModel.dataBasis} id="analysis-data-basis-details" />
      </details>
    </main>
  );
};
