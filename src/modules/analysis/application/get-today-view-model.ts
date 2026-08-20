import { createAnalysisRepository } from "@/modules/analysis/infrastructure/prisma-analysis-repository";
import { PROVISIONAL_SCHEDULE_RULES } from "@/shared/domain/provisional-schedule-rules";
import { systemClock } from "@/shared/time/system-clock";
import { wakeLocalDate } from "@/shared/time/local-date";
import { getPrismaClient } from "@/shared/db/prisma";
import type { ConfidenceLevel, DisplayState, Clock, UserScope } from "@/shared/domain/contracts";
import type { AnalysisResult, SleepGoal } from "@/modules/analysis/domain/types";
import { TransactionClient } from "@/shared/db/transaction";
import type { AnalysisSnapshotStatus } from "@/modules/analysis/application/ports";
import type { EntryPresence } from "@/modules/records/application/get-record-hub";
import type { RecordType } from "@/modules/records/domain/types";

export type RegionViewModel<T> = Readonly<{
  state: DisplayState;
  data: T | null;
  message: string | null;
  action: { label: string; href: string } | null;
}>;

export type ReadinessViewModel = Readonly<{
  score: number | null;
  confidence: ConfidenceLevel;
  label: string;
}>;

export type DataStatusViewModel = Readonly<{
  completedCategories: number;
  totalCategories: 7;
  missingLabels: readonly string[];
}>;

export type PreparationStepViewModel = Readonly<{
  key: string;
  label: string;
  scheduledAt: string;
  status: "upcoming" | "current" | "done";
}>;

export type PreparationSource =
  | Readonly<{ kind: "goal"; targetBedAt: string; caffeineCutoffAt: string; exerciseCutoffAt: string; mealCutoffAt: string; windDownAt: string }>
  | Readonly<{ kind: "plan-day"; planDayId: string; targetBedAt: string; caffeineCutoffAt: string; exerciseCutoffAt: string; mealCutoffAt: string; windDownAt: string }>;

export type RecordSummaryItem = Readonly<{
  type: RecordType;
  label: string;
  presence: EntryPresence;
  href: string;
}>;

export type TodayViewModel = Readonly<{
  localDate: string;
  readiness: RegionViewModel<ReadinessViewModel>;
  dataStatus: RegionViewModel<DataStatusViewModel>;
  preparationTimeline: RegionViewModel<PreparationStepViewModel[]>;
  recordSummary: RegionViewModel<RecordSummaryItem[]>;
  hasRerouteAdvice: boolean;
}>;

type AnalysisSnapshotRow = Readonly<{
  id: string;
  localDate: string;
  timezone: string;
  status: AnalysisSnapshotStatus;
  result: unknown;
  generatedAt: Date;
  supersededAt: Date | null;
}>;

type PrismaAnalysisClient = Readonly<{
  sleepGoal: {
    findUnique: (args: unknown) => Promise<{
      targetBedTime: string | null;
      targetWakeTime: string | null;
      targetDurationMinutes: number | null;
    } | null>;
  };
  planDay: {
    findFirst: (args: unknown) => Promise<{
      id: string;
      targetBedAt: Date;
      caffeineCutoffAt: Date;
      exerciseCutoffAt: Date;
      mealCutoffAt: Date;
      windDownAt: Date;
    } | null>;
  };
  analysisSnapshot: {
    findMany: (args: {
      where: { userId: string; timezone: string; localDate: string; status?: string };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }) => Promise<readonly AnalysisSnapshotRow[]>;
  };
  caffeineEntry: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  alcoholEntry: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  mealEntry: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  exerciseEntry: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  sleepSession: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  phoneUsageEntry: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  wellnessEntry: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  scheduleAdvice?: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
}>;

type GetTodayViewModelDependencies = Readonly<{
  clock?: Clock;
  getPrisma?: () => PrismaAnalysisClient;
}>;

type SnapshotState = Readonly<{
  state: "ready" | "stale" | "insufficient" | "error";
  snapshot: AnalysisResult | null;
  message: string | null;
  action: { label: string; href: string } | null;
}>;

const DEFAULT_GOAL: SleepGoal = {
  targetBedTime: "23:00",
  targetWakeTime: "07:00",
  targetDurationMinutes: 480,
};

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (value: string): number | null => {
  const matched = TIME_RE.exec(value);
  if (!matched) {
    return null;
  }

  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
};

const addMinutes = (total: number): number => ((total % 1440) + 1440) % 1440;

const formatClockMinutes = (value: number): string => {
  const normalized = addMinutes(value);
  const hour = Math.floor(normalized / 60).toString().padStart(2, "0");
  const minute = (normalized % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
};

const extractTime = (goalTime: string | null, fallback: string): string => {
  const minutes = toMinutes(goalTime ?? fallback);
  if (minutes === null) {
    return formatClockMinutes(toMinutes(fallback) ?? 0);
  }
  return formatClockMinutes(minutes);
};

const minusMinutes = (time: string, offset: number): string => {
  const minute = toMinutes(time) ?? 0;
  return formatClockMinutes(minute - offset);
};

const parseConfidenceLabel = (confidence: ConfidenceLevel): string => {
  if (confidence === "high") {
    return "좋음";
  }
  if (confidence === "medium") {
    return "보통";
  }
  if (confidence === "low") {
    return "낮음";
  }
  return "낮음";
};

const missingFieldLabel = (field: string): string => {
  const map: Readonly<Record<string, string>> = {
    sleep: "수면 기록",
    phone: "휴대폰 기록",
    meal: "식사",
    exercise: "운동",
    caffeine: "카페인",
    alcohol: "음주",
    wellness: "컨디션",
  };

  return map[field] ?? field;
};

const minutesNow = (clock: Clock, timezone: string): number | null => {
  try {
    const now = clock.now();
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }
    return hour * 60 + minute;
  } catch {
    return null;
  }
};

const toPreparationSource = (goal: SleepGoal): PreparationSource => ({
  kind: "goal",
  targetBedAt: extractTime(goal.targetBedTime, DEFAULT_GOAL.targetBedTime),
  caffeineCutoffAt: minusMinutes(extractTime(goal.targetBedTime, DEFAULT_GOAL.targetBedTime), PROVISIONAL_SCHEDULE_RULES.caffeineCutoffMinutesBeforeBed),
  exerciseCutoffAt: minusMinutes(extractTime(goal.targetBedTime, DEFAULT_GOAL.targetBedTime), PROVISIONAL_SCHEDULE_RULES.exerciseCutoffMinutesBeforeBed),
  mealCutoffAt: minusMinutes(extractTime(goal.targetBedTime, DEFAULT_GOAL.targetBedTime), PROVISIONAL_SCHEDULE_RULES.mealCutoffMinutesBeforeBed),
  windDownAt: minusMinutes(extractTime(goal.targetBedTime, DEFAULT_GOAL.targetBedTime), PROVISIONAL_SCHEDULE_RULES.windDownMinutesBeforeBed),
});

const formatPlanTime = (value: Date, timezone: string): string => new Intl.DateTimeFormat("en-GB", {
  timeZone: timezone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format(value);

const toPlanDayPreparationSource = (planDay: NonNullable<Awaited<ReturnType<PrismaAnalysisClient["planDay"]["findFirst"]>>>, timezone: string): PreparationSource => ({
  kind: "plan-day",
  planDayId: planDay.id,
  targetBedAt: formatPlanTime(planDay.targetBedAt, timezone),
  caffeineCutoffAt: formatPlanTime(planDay.caffeineCutoffAt, timezone),
  exerciseCutoffAt: formatPlanTime(planDay.exerciseCutoffAt, timezone),
  mealCutoffAt: formatPlanTime(planDay.mealCutoffAt, timezone),
  windDownAt: formatPlanTime(planDay.windDownAt, timezone),
});

const readinessMessageFromSnapshot = (snapshot: SnapshotState): string | null => {
  if (snapshot.state === "ready" || snapshot.state === "stale") {
    return snapshot.state === "stale" ? "마지막 정상 분석을 표시합니다" : null;
  }
  return snapshot.message ?? "오늘 분석이 부족해요";
};

const buildReadinessViewModel = (snapshot: SnapshotState): TodayViewModel["readiness"] => {
  if (!snapshot.snapshot) {
    return {
      state: snapshot.state,
      data: null,
      message: snapshot.message ?? "오늘 분석이 부족해요",
      action: snapshot.action,
    };
  }

  const scoreLabel = snapshot.snapshot.readiness === null
    ? "점수 산출 불가"
    : `${snapshot.snapshot.readiness}점`;

  return {
    state: snapshot.state,
    data: {
      score: snapshot.snapshot.readiness,
      confidence: snapshot.snapshot.confidence,
      label: `${scoreLabel} (${parseConfidenceLabel(snapshot.snapshot.confidence)})`.trim(),
    },
    message: readinessMessageFromSnapshot(snapshot),
    action: snapshot.action,
  };
};

const buildDataStatusViewModel = (snapshot: SnapshotState): TodayViewModel["dataStatus"] => {
  if (!snapshot.snapshot) {
    return {
      state: snapshot.state,
      data: null,
      message: snapshot.message ?? "데이터 기준이 부족합니다",
      action: snapshot.action,
    };
  }

  const basis = snapshot.snapshot.dataBasis;
  const missing = basis.missingFields.map((field) => missingFieldLabel(field));
  const completedCategories = 7 - missing.length;

  return {
    state: missing.length > 0 ? "insufficient" : "ready",
    data: {
      completedCategories,
      totalCategories: 7,
      missingLabels: missing,
    },
    message: missing.length === 0
      ? `데이터 기준 7개 항목 중 ${completedCategories}개 충족`
      : `${missing.length}개 항목을 더 채우면 분석 정확도가 올라가요`,
    action: null,
  };
};

const buildPreparationTimeline = (
  source: PreparationSource,
  clock: Clock,
  timezone: string,
): TodayViewModel["preparationTimeline"] => {
  const nowMinute = minutesNow(clock, timezone);
  const steps = [
    {
      key: "caffeine",
      label: "카페인 마감",
      scheduledAt: source.caffeineCutoffAt,
      minute: toMinutes(source.caffeineCutoffAt) ?? 0,
    },
    {
      key: "exercise",
      label: "운동 마감",
      scheduledAt: source.exerciseCutoffAt,
      minute: toMinutes(source.exerciseCutoffAt) ?? 0,
    },
    {
      key: "meal",
      label: "식사 마감",
      scheduledAt: source.mealCutoffAt,
      minute: toMinutes(source.mealCutoffAt) ?? 0,
    },
    {
      key: "windDown",
      label: "휴대폰 디지털 디톡스 시작",
      scheduledAt: source.windDownAt,
      minute: toMinutes(source.windDownAt) ?? 0,
    },
  ].sort((left, right) => left.minute - right.minute);

  const firstUpcoming = nowMinute === null ? 0 : steps.findIndex((step) => addMinutes(step.minute) > nowMinute);
  const timeline = steps.map((step, index) => ({
    key: step.key,
    label: step.label,
    scheduledAt: step.scheduledAt,
    status: nowMinute === null || firstUpcoming === -1
      ? "done"
      : index < firstUpcoming
        ? "done"
        : index === firstUpcoming
          ? "current"
          : "upcoming",
  } satisfies PreparationStepViewModel));

  return {
    state: "ready",
    data: timeline,
    message: `오늘 목표 취침 ${source.targetBedAt} 기준`,
    action: null,
  };
};

const toEntryPresence = (present: boolean): EntryPresence => (present ? "completed" : "empty");

const buildRecordSummary = async (db: PrismaAnalysisClient, scope: UserScope, localDate: string): Promise<TodayViewModel["recordSummary"]> => {
  const [
    caffeine,
    alcohol,
    meal,
    exercise,
    sleep,
    phone,
    wellness,
  ] = await Promise.all([
    db.caffeineEntry.findFirst({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        dailyLog: {
          localDate,
        },
      },
      select: {
        id: true,
      },
    }),
    db.alcoholEntry.findFirst({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        dailyLog: {
          localDate,
        },
      },
      select: {
        id: true,
      },
    }),
    db.mealEntry.findFirst({
      where: {
        userId: scope.userId,
        dailyLog: {
          localDate,
        },
      },
      include: {
        dailyLog: {
          select: {
            localDate: true,
          },
        },
      },
      select: {
        id: true,
      },
    }),
    db.exerciseEntry.findFirst({
      where: {
        userId: scope.userId,
        dailyLog: {
          localDate,
        },
      },
      include: {
        dailyLog: {
          select: {
            localDate: true,
          },
        },
      },
      select: {
        id: true,
      },
    }),
    db.sleepSession.findFirst({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        sleepDate: localDate,
      },
      select: {
        id: true,
      },
    }),
    db.phoneUsageEntry.findFirst({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        localDate,
      },
      select: {
        id: true,
      },
    }),
    db.wellnessEntry.findFirst({
      where: {
        userId: scope.userId,
        timezone: scope.timezone,
        localDate,
      },
      select: {
        id: true,
      },
    }),
  ]);

  const rows: ReadonlyArray<RecordSummaryItem> = [
    { type: "caffeine", label: "카페인", presence: toEntryPresence(Boolean(caffeine)), href: "/record/caffeine?step=brand" },
    { type: "alcohol", label: "음주", presence: toEntryPresence(Boolean(alcohol)), href: "/record/alcohol?step=type" },
    { type: "meal", label: "식사", presence: toEntryPresence(Boolean(meal)), href: "/record/meal-health?step=meal" },
    { type: "exercise", label: "운동", presence: toEntryPresence(Boolean(exercise)), href: "/record/meal-health?step=exercise-and-wellness" },
    { type: "sleep", label: "수면", presence: toEntryPresence(Boolean(sleep)), href: "/record/sleep-phone?step=sleep" },
    { type: "phone-usage", label: "휴대폰", presence: toEntryPresence(Boolean(phone)), href: "/record/sleep-phone?step=phone" },
    { type: "wellness", label: "컨디션", presence: toEntryPresence(Boolean(wellness)), href: "/record/meal-health?step=exercise-and-wellness" },
  ];

  const completed = rows.filter((item) => item.presence === "completed").length;
  const message = completed === 0 ? "아직 기록이 없습니다" : `오늘 기록 ${completed}개 완료`;

  return {
    state: completed === 0 ? "insufficient" : "ready",
    data: rows,
    message,
    action: completed === 0 ? { label: "기록 시작", href: "/record" } : null,
  };
};

const resolveAnalysisState = async (
  analysisRepository: ReturnType<typeof createAnalysisRepository>,
  localDate: string,
): Promise<SnapshotState> => {
  const current = await analysisRepository.findCurrent(localDate);
  if (!current) {
    const fallback = await analysisRepository.findLastSuccessful(localDate);
    if (!fallback) {
      return {
        state: "insufficient",
        snapshot: null,
        message: "오늘 분석에 필요한 기록이 부족해요",
        action: {
          label: "기록 시작",
          href: "/record",
        },
      };
    }

    if (fallback.ok) {
      return {
        state: "stale",
        snapshot: fallback.value,
        message: "마지막 정상 분석을 표시합니다",
        action: null,
      };
    }

    return {
      state: "insufficient",
      snapshot: null,
      message: "분석 데이터가 손상되어 다시 계산해야 합니다",
      action: {
        label: "재계산",
        href: "/record",
      },
    };
  }

  if (current.ok) {
    return {
      state: "ready",
      snapshot: current.value,
      message: null,
      action: null,
    };
  }

  const fallback = await analysisRepository.findLastSuccessful(localDate);
  if (!fallback) {
    return {
      state: "insufficient",
      snapshot: null,
      message: "분석 데이터가 손상되어 다시 계산해야 합니다",
      action: {
        label: "재계산",
        href: "/record",
      },
    };
  }

  if (fallback.ok) {
    return {
      state: "stale",
      snapshot: fallback.value,
      message: "마지막 정상 분석을 표시합니다",
      action: {
        label: "재계산",
        href: "/record",
      },
    };
  }

  return {
    state: "insufficient",
    snapshot: null,
    message: "분석 데이터가 손상되어 다시 계산해야 합니다",
    action: {
      label: "재계산",
      href: "/record",
    },
  };
};

const getSleepGoal = async (db: PrismaAnalysisClient, userId: string): Promise<SleepGoal> => {
  const row = await db.sleepGoal.findUnique({
    where: { userId },
    select: {
      targetBedTime: true,
      targetWakeTime: true,
      targetDurationMinutes: true,
    },
  });

  if (!row) {
    return DEFAULT_GOAL;
  }

  return {
    targetBedTime: extractTime(row.targetBedTime, DEFAULT_GOAL.targetBedTime),
    targetWakeTime: extractTime(row.targetWakeTime, DEFAULT_GOAL.targetWakeTime),
    targetDurationMinutes: Number(row.targetDurationMinutes ?? DEFAULT_GOAL.targetDurationMinutes),
  };
};

export const getTodayViewModel = async (
  scope: UserScope,
  dependencies: GetTodayViewModelDependencies = {},
): Promise<TodayViewModel> => {
  const clock = dependencies.clock ?? systemClock;
  const localDate = wakeLocalDate(clock.now(), scope.timezone);

  const prisma = (dependencies.getPrisma
    ? dependencies.getPrisma()
    : getPrismaClient()) as PrismaAnalysisClient;

  const analysisRepository = createAnalysisRepository(prisma as unknown as TransactionClient, scope);

  const [analysisState, goal, planDay, rerouteAdvice] = await Promise.all([
    resolveAnalysisState(analysisRepository, localDate),
    getSleepGoal(prisma, scope.userId),
    prisma.planDay.findFirst({
      where: { userId: scope.userId, localDate, status: "active" },
      select: { id: true, targetBedAt: true, caffeineCutoffAt: true, exerciseCutoffAt: true, mealCutoffAt: true, windDownAt: true },
    }),
    prisma.scheduleAdvice
      ? prisma.scheduleAdvice.findFirst({ where: { userId: scope.userId, status: "generated", triggerType: "reroute" }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  const preparationSource = planDay ? toPlanDayPreparationSource(planDay, scope.timezone) : toPreparationSource(goal);

  const recordSummary = await buildRecordSummary(prisma, scope, localDate).catch(() => ({
    state: "error" as const,
    data: null as const,
    message: "오늘 기록을 불러오지 못했어요",
    action: null,
  }));

  return {
    localDate,
    readiness: buildReadinessViewModel(analysisState),
    dataStatus: buildDataStatusViewModel(analysisState),
    preparationTimeline: buildPreparationTimeline(preparationSource, clock, scope.timezone),
    recordSummary,
    hasRerouteAdvice: rerouteAdvice !== null,
  };
};
