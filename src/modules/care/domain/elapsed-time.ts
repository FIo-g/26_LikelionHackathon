export const elapsedMilliseconds = (
  completedSegmentsMs: number,
  activeStartedAtMs: number | null,
  nowMs: number,
): number => completedSegmentsMs + (activeStartedAtMs === null ? 0 : Math.max(0, nowMs - activeStartedAtMs));

export const elapsedSeconds = (activeStartedAtMs: number, nowMs: number): number => (
  Math.floor(elapsedMilliseconds(0, activeStartedAtMs, nowMs) / 1000)
);
