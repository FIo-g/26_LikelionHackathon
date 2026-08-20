import { afterEach, describe, expect, it, vi } from "vitest";

import {
  VISUAL_CLOCK_CAPABILITY_SYMBOL,
  VISUAL_FIXTURE_NOW,
  VISUAL_FIXTURE_NOW_ISO,
  visualServerClockForEnvironment,
} from "@/shared/time/visual-server-clock";

const createCapabilityTarget = (): object => {
  const target = {};
  Object.defineProperty(target, VISUAL_CLOCK_CAPABILITY_SYMBOL, {
    value: Object.freeze({ fixedNowEpochMs: VISUAL_FIXTURE_NOW.getTime() }),
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return target;
};

describe("visualServerClockForEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the fixed fixture instant only when the bootstrap capability is installed", () => {
    const clock = visualServerClockForEnvironment(createCapabilityTarget());

    expect(clock?.now().toISOString()).toBe(VISUAL_FIXTURE_NOW_ISO);
  });

  it("fails closed when public environment flags are spoofed without a bootstrap capability", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ADAPTIVE_SLEEP_E2E_TEST_MODE", "1");
    vi.stubEnv("VISUAL_TEST", "1");
    vi.stubEnv("ADAPTIVE_SLEEP_VISUAL_FIXED_NOW", VISUAL_FIXTURE_NOW_ISO);
    vi.stubEnv("DATABASE_URL", "file:./adaptive-sleep-e2e.sqlite");

    expect(visualServerClockForEnvironment({})).toBeNull();
  });

  it("rejects mutable or malformed symbol values", () => {
    const target = {};
    Object.defineProperty(target, VISUAL_CLOCK_CAPABILITY_SYMBOL, {
      value: { fixedNowEpochMs: VISUAL_FIXTURE_NOW.getTime() },
      enumerable: false,
      configurable: false,
      writable: false,
    });

    expect(visualServerClockForEnvironment(target)).toBeNull();
  });
});
