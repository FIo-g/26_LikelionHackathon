import { TimeInputError } from "@/shared/validation/errors";

const getSupportedTimezones = (): ReadonlySet<string> => {
  try {
    return new Set(Intl.supportedValuesOf("timeZone"));
  } catch {
    return new Set(["Asia/Seoul", "America/New_York", "Europe/London", "UTC"]);
  }
};

const isSupportedTimezone = (timezone: string): boolean => {
  const normalized = timezone.trim();
  const supported = getSupportedTimezones();
  if (supported.has(normalized)) {
    return true;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: normalized });
    return true;
  } catch {
    return false;
  }
};

export const wakeLocalDate = (endedAt: Date, timezone: string): string => {
  if (!(endedAt instanceof Date) || Number.isNaN(endedAt.getTime()) || !isSupportedTimezone(timezone)) {
    throw new TimeInputError();
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone.trim(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(endedAt);
};
