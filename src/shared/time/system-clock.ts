import type { Clock } from "@/shared/domain/contracts";

import { visualServerClockForEnvironment } from "./visual-server-clock";

export const systemClock: Clock = visualServerClockForEnvironment() ?? {
  now: () => new Date(),
};
