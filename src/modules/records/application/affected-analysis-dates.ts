export const ROLLING_ANALYSIS_DAYS = 14;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const msPerDay = 24 * 60 * 60 * 1000;

const toUtcMidnight = (localDate: string): number => {
  if (!LOCAL_DATE_RE.test(localDate)) {
    throw new Error("INVALID_LOCAL_DATE");
  }

  const parsed = Date.parse(`${localDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) {
    throw new Error("INVALID_LOCAL_DATE");
  }

  return parsed;
};

const formatLocalDate = (valueMs: number): string => {
  const date = new Date(valueMs);
  return date.toISOString().slice(0, 10);
};

export const affectedAnalysisDates = (
  startLocalDate: string,
  endLocalDate = startLocalDate,
): readonly string[] => {
  const start = toUtcMidnight(startLocalDate);
  const end = toUtcMidnight(endLocalDate);

  if (end < start) {
    return [];
  }

  const maxEnd = Math.min(end, start + (ROLLING_ANALYSIS_DAYS - 1) * msPerDay);

  const dates: string[] = [];
  for (let current = start; current <= maxEnd; current += msPerDay) {
    dates.push(formatLocalDate(current));
  }

  return dates;
};
