import { createAnalysisRepository } from "@/modules/analysis/infrastructure/prisma-analysis-repository";
import { getPlanViewModel, type ScheduleAdviceViewModel } from "@/modules/planner/application/get-plan-view-model";
import { createPrismaPlannerRepository } from "@/modules/planner/infrastructure/prisma-planner-repository";
import { recoverStaleNarrations } from "@/modules/narration/application/generate-narration";
import type { NarrationRepository } from "@/modules/narration/application/ports";
import { createPrismaNarrationRepository } from "@/modules/narration/infrastructure/prisma-narration-repository";
import type { Clock, DisplayState, UserScope } from "@/shared/domain/contracts";
import { getPrismaClient } from "@/shared/db/prisma";
import type { TransactionClient } from "@/shared/db/transaction";
import { wakeLocalDate } from "@/shared/time/local-date";
import { systemClock } from "@/shared/time/system-clock";
import type { AnalysisResult, DataBasis, Evidence, NormalizedAnalysisInput } from "../domain/types";

export type MetricViewModel = Readonly<{
  key: "sleep-rhythm" | "phone-wind-down" | "caffeine-signal" | "sleep-goal";
  label: string;
  value: number | null;
  state: DisplayState;
}>;

export type TrendPoint = Readonly<{
  localDate: string;
  sleepMinutes: number | null;
  goalMinutes: number;
}>;

export type CaffeineProfileViewModel = Readonly<{
  signal: number | null;
  wording: "관찰된 신호";
  whatIfEnabled: boolean;
}>;

export type EvidenceViewModel = Evidence;

export type ReportViewModel = Readonly<{
  status: "pending" | "ready" | "template-fallback" | "failed";
  headline: string;
  body: string;
  bullets: readonly string[];
}>;

export type AnalyzeViewModel = Readonly<{
  state: DisplayState;
  metrics: readonly MetricViewModel[];
  trend: readonly TrendPoint[];
  caffeineProfile: CaffeineProfileViewModel;
  explainability: readonly EvidenceViewModel[];
  dataBasis: DataBasis;
  report: ReportViewModel;
  narration: Readonly<{ id: string; retryAvailable: boolean }> | null;
  scheduleAdvice: ScheduleAdviceViewModel | null;
}>;

type Dependencies = Readonly<{
  clock?: Clock;
  getPrisma?: () => TransactionClient;
  createAnalysisRepository?: typeof createAnalysisRepository;
  createPlannerRepository?: typeof createPrismaPlannerRepository;
  createNarrationRepository?: (db: TransactionClient, scope: UserScope) => NarrationRepository;
}>;

const hasNarrationModel = (db: TransactionClient): db is TransactionClient & { narration: object } => (
  "narration" in db
);

const emptyDataBasis: DataBasis = {
  periodStart: "",
  periodEnd: "",
  sampleCount: 0,
  excludedCount: 0,
  missingFields: [],
  completenessByCategory: {
    sleep: 0,
    phone: 0,
    caffeine: 0,
    alcohol: 0,
    exercise: 0,
    meal: 0,
    wellness: 0,
  },
  sourceDistribution: {
    manual: 0,
  },
  computedAt: "",
  algorithmVersion: "provisional-v1",
  confidence: "low",
};

const metricDefinitions = [
  ["sleep-rhythm", "수면 리듬", "sleepRhythmStability"],
  ["phone-wind-down", "폰 정리", "phoneWindDown"],
  ["caffeine-signal", "카페인", "caffeineSignal"],
  ["sleep-goal", "수면 목표", "sleepGoalAttainment"],
] as const;

const reportFor = (result: AnalysisResult | null): ReportViewModel => {
  if (!result) {
    return {
      status: "pending",
      headline: "분석을 준비하고 있어요",
      body: "수면과 생활 기록이 쌓이면 최근 패턴을 함께 살펴볼 수 있어요.",
      bullets: ["기록이 부족한 항목은 추정하지 않습니다."],
    };
  }

  return {
    status: "template-fallback",
    headline: "최근 수면 패턴",
    body: `최근 ${result.dataBasis.sampleCount}일의 기록을 바탕으로 정리했어요.`,
    bullets:
      result.evidence.length > 0
        ? result.evidence.slice(0, 3).map((evidence) => evidence.label)
        : ["기록이 쌓이면 관찰된 패턴을 더 자세히 보여드려요."],
  };
};

const snapshotResult = async (
  scope: UserScope,
  localDate: string,
  getPrisma: () => TransactionClient,
  createRepository: typeof createAnalysisRepository,
) => {
  const repository = createRepository(getPrisma(), scope);
  const current = await repository.findCurrent(localDate);

  if (current?.ok) {
    return { entity: current.value, result: current.value.result, state: "ready" as DisplayState, repository };
  }

  const lastGood = await repository.findLastSuccessful(localDate);
  if (lastGood?.ok) {
    return { entity: lastGood.value, result: lastGood.value.result, state: "stale" as DisplayState, repository };
  }

  return {
    result: null,
    entity: null,
    state: current && !current.ok ? ("error" as DisplayState) : ("insufficient" as DisplayState),
    repository,
  };
};

const trendFor = (input: NormalizedAnalysisInput | null): readonly TrendPoint[] =>
  input
    ? [...input.days]
        .sort((left, right) => left.localDate.localeCompare(right.localDate))
        .map((day) => ({
          localDate: day.localDate,
          sleepMinutes: day.sleepMinutes,
          goalMinutes: input.goal.targetDurationMinutes,
        }))
    : [];

export const getAnalyzeViewModel = async (
  scope: UserScope,
  dependencies: Dependencies = {},
): Promise<AnalyzeViewModel> => {
  const clock = dependencies.clock ?? systemClock;
  const getPrisma = dependencies.getPrisma ?? getPrismaClient;
  const createAnalysis = dependencies.createAnalysisRepository ?? createAnalysisRepository;
  const createPlanner = dependencies.createPlannerRepository ?? createPrismaPlannerRepository;
  const createNarration = dependencies.createNarrationRepository ?? createPrismaNarrationRepository;
  const localDate = wakeLocalDate(clock.now(), scope.timezone);
  const snapshot = await snapshotResult(scope, localDate, getPrisma, createAnalysis);
  const result = snapshot.result;
  let narration: Awaited<ReturnType<NarrationRepository["findForAnalysisSnapshot"]>> = null;
  const narrationDb = getPrisma();
  if (snapshot.entity && hasNarrationModel(narrationDb)) {
    const narrationRepository = createNarration(narrationDb, scope);
    await recoverStaleNarrations(clock.now(), narrationRepository);
    narration = await narrationRepository.findForAnalysisSnapshot(snapshot.entity.id);
  }

  let input: NormalizedAnalysisInput | null = null;
  try {
    input = await snapshot.repository.loadWindow(localDate, 14);
  } catch {
    input = null;
  }

  let scheduleAdvice: ScheduleAdviceViewModel | null = null;
  try {
    scheduleAdvice = (await getPlanViewModel(
      createPlanner(getPrisma(), scope),
      clock.now(),
      scope.timezone,
    )).advice;
  } catch {
    scheduleAdvice = null;
  }

  return {
    state: snapshot.state,
    metrics: metricDefinitions.map(([key, label, metricKey]) => ({
      key,
      label,
      value: result?.metrics[metricKey] ?? null,
      state: result ? snapshot.state : "insufficient",
    })),
    trend: trendFor(input),
    caffeineProfile: {
      signal: result?.metrics.caffeineSignal ?? null,
      wording: "관찰된 신호",
      whatIfEnabled: result !== null && input !== null,
    },
    explainability: result?.evidence ?? [],
    dataBasis: result?.dataBasis ?? emptyDataBasis,
    report: narration?.output
      ? { status: narration.status === "ready" ? "ready" : "template-fallback", ...narration.output }
      : reportFor(result),
    narration: narration
      ? { id: narration.id, retryAvailable: narration.status === "template-fallback" && narration.retryCount < 2 }
      : null,
    scheduleAdvice,
  };
};
