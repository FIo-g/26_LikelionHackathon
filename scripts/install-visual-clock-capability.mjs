const VISUAL_CLOCK_CAPABILITY_KEY = "adaptive-sleep.visual-clock-capability.v1";
const VISUAL_FIXTURE_NOW_ISO = "2026-08-19T12:00:00.000Z";
const capabilitySymbol = Symbol.for(VISUAL_CLOCK_CAPABILITY_KEY);

if (Object.prototype.hasOwnProperty.call(globalThis, capabilitySymbol)) {
  throw new Error("VISUAL_CLOCK_CAPABILITY_ALREADY_INSTALLED");
}

Object.defineProperty(globalThis, capabilitySymbol, {
  value: Object.freeze({ fixedNowEpochMs: Date.parse(VISUAL_FIXTURE_NOW_ISO) }),
  enumerable: false,
  configurable: false,
  writable: false,
});
