const MINUTES_PER_DAY = 60 * 24;

const parseClockMinute = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new Error("INVALID_CLOCK_TIME");
  }

  return (hours * 60) + minutes;
};

export const calculateSleepDurationMinutes = ({ targetBedTime, targetWakeTime }: Readonly<{ targetBedTime: string; targetWakeTime: string; }>): number => {
  const bedMinutes = parseClockMinute(targetBedTime);
  let wakeMinutes = parseClockMinute(targetWakeTime);

  if (wakeMinutes <= bedMinutes) {
    wakeMinutes += MINUTES_PER_DAY;
  }

  return wakeMinutes - bedMinutes;
};

