import type { Clock } from "@/shared/domain/contracts";

export const VISUAL_FIXTURE_NOW_ISO = "2026-08-19T12:00:00.000Z";
export const VISUAL_FIXTURE_NOW = new Date(VISUAL_FIXTURE_NOW_ISO);
export const VISUAL_CLOCK_CAPABILITY_SYMBOL = Symbol.for("adaptive-sleep.visual-clock-capability.v1");

type VisualClockCapability = Readonly<{
  fixedNowEpochMs: number;
}>;

const isVisualClockCapability = (value: unknown): value is VisualClockCapability => (
  typeof value === "object"
  && value !== null
  && Object.isFrozen(value)
  && "fixedNowEpochMs" in value
  && value.fixedNowEpochMs === VISUAL_FIXTURE_NOW.getTime()
);

const readVisualClockCapability = (target: object): VisualClockCapability | null => {
  const descriptor = Object.getOwnPropertyDescriptor(target, VISUAL_CLOCK_CAPABILITY_SYMBOL);
  if (
    !descriptor
    || descriptor.enumerable !== false
    || descriptor.configurable !== false
    || descriptor.writable !== false
    || !isVisualClockCapability(descriptor.value)
  ) {
    return null;
  }

  return descriptor.value;
};

/**
 * Visual baselines need a stable current day for their seeded analysis data.
 * The validated visual E2E launcher installs this immutable capability through
 * a Node preload. Environment variables never activate this application clock.
 */
export const visualServerClockForEnvironment = (
  target: object = globalThis,
): Clock | null => {
  const capability = readVisualClockCapability(target);
  if (!capability) {
    return null;
  }

  return {
    now: () => new Date(capability.fixedNowEpochMs),
  };
};
