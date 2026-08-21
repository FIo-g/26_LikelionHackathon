import { Temporal } from "@js-temporal/polyfill";

import { TimeInputError } from "@/shared/validation/errors";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type ZonedDateTimeInput = Readonly<{
  localDate: string;
  localTime: string;
  timezone: string;
  offsetMinutes?: number;
}>;

export type OffsetChoice = Readonly<{
  offsetMinutes: number;
  label: string;
}>;

export type WallTimeDisambiguation = "earlier" | "later";

export type LocalRecordTime = Readonly<{
  value: string;
  disambiguation?: WallTimeDisambiguation;
}>;

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

const formatOffsetMinutes = (offsetMinutes: number): string => {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
};

const parseOffset = (offset: string): number => {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) {
    throw new TimeInputError();
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * (hours * 60 + minutes);
};

const isValidWallDateAndTime = (localDate: string, localTime: string): boolean => (
  DATE_REGEX.test(localDate) && TIME_REGEX.test(localTime)
);

const toOffsetChoice = (zonedDateTime: Temporal.ZonedDateTime, timezone: string, localDate: string, localTime: string): OffsetChoice | null => {
  const utcDate = new Date(zonedDateTime.epochMilliseconds);

  const resolvedDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(utcDate);
  if (resolvedDate !== localDate) {
    return null;
  }

  const resolvedTime = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(utcDate);
  if (resolvedTime !== localTime) {
    return null;
  }

  return {
    offsetMinutes: parseOffset(zonedDateTime.offset),
    label: `UTC${formatOffsetMinutes(parseOffset(zonedDateTime.offset))}`,
  };
};

export const parseZonedDateTime = ({
  localDate,
  localTime,
  timezone,
  offsetMinutes,
}: ZonedDateTimeInput): Date => {
  if (!isValidWallDateAndTime(localDate, localTime) || !isSupportedTimezone(timezone)) {
    throw new TimeInputError();
  }

  const normalizedTimezone = timezone.trim();
  const wallDateTime = `${localDate}T${localTime}:00`;

  try {
    const source = offsetMinutes === undefined
      ? `${wallDateTime}[${normalizedTimezone}]`
      : `${wallDateTime}${formatOffsetMinutes(offsetMinutes)}[${normalizedTimezone}]`;

    const zonedDateTime = Temporal.ZonedDateTime.from(source, {
      disambiguation: "reject",
      ...(offsetMinutes === undefined ? {} : { offset: "reject" }),
    });

    return new Date(zonedDateTime.epochMilliseconds);
  } catch {
    throw new TimeInputError();
  }
};

export const possibleOffsetsForWallTime = ({
  localDate,
  localTime,
  timezone,
}: Omit<ZonedDateTimeInput, "offsetMinutes">): ReadonlyArray<OffsetChoice> => {
  if (!isValidWallDateAndTime(localDate, localTime) || !isSupportedTimezone(timezone)) {
    return [];
  }

  const normalizedTimezone = timezone.trim();
  const wallDateTime = `${localDate}T${localTime}:00`;
  const choices: OffsetChoice[] = [];
  const seen = new Set<number>();

  for (const disambiguation of ["earlier", "later"] as const) {
    try {
      const zonedDateTime = Temporal.ZonedDateTime.from(`${wallDateTime}[${normalizedTimezone}]`, {
        disambiguation,
      });
      const utcDate = new Date(zonedDateTime.epochMilliseconds);
      const key = utcDate.getTime();
      if (seen.has(key)) {
        continue;
      }

      const choice = toOffsetChoice(zonedDateTime, normalizedTimezone, localDate, localTime);
      if (!choice) {
        continue;
      }

      seen.add(key);
      choices.push(choice);
    } catch {
      // No offset for this disambiguation; continue to try the next one.
    }
  }

  return choices;
};

const splitRecordWallTime = (value: string): { localDate: string; localTime: string } => {
  const match = /^(\d{4}-\d{2}-\d{2})T([0-2]\d:[0-5]\d)$/.exec(value.trim());
  if (!match) {
    throw new TimeInputError("INVALID_LOCAL_TIME");
  }

  return { localDate: match[1], localTime: match[2] };
};

/** Returns whether this local date-time occurs more than once in its timezone. */
export const requiresRecordWallTimeDisambiguation = (
  value: string,
  timezone: string,
): boolean => {
  try {
    const { localDate, localTime } = splitRecordWallTime(value);
    return possibleOffsetsForWallTime({ localDate, localTime, timezone }).length > 1;
  } catch {
    return false;
  }
};

/**
 * Supplies an explicit occurrence only for a repeated local time. Existing
 * later-occurrence edits stay later; irrelevant stale values are not submitted.
 */
export const resolveRecordWallTimeDisambiguation = (
  value: string,
  disambiguation: string | undefined,
  timezone: string,
): WallTimeDisambiguation | "" => {
  if (!requiresRecordWallTimeDisambiguation(value, timezone)) {
    return "";
  }

  return disambiguation === "later" ? "later" : "earlier";
};

export const parseRecordWallTime = (
  input: string | LocalRecordTime,
  timezone: string,
): Date => {
  const local = typeof input === "string" ? { value: input } : input;
  const { localDate, localTime } = splitRecordWallTime(local.value);
  const offsets = possibleOffsetsForWallTime({ localDate, localTime, timezone });

  if (offsets.length === 0) {
    throw new TimeInputError("NONEXISTENT_LOCAL_TIME");
  }

  if (offsets.length > 1 && local.disambiguation === undefined) {
    throw new TimeInputError("AMBIGUOUS_LOCAL_TIME");
  }

  const choice = offsets.length === 1
    ? offsets[0]
    : offsets[local.disambiguation === "later" ? offsets.length - 1 : 0];

  return parseZonedDateTime({
    localDate,
    localTime,
    timezone,
    offsetMinutes: choice.offsetMinutes,
  });
};

export const formatRecordWallTime = (instant: Date, timezone: string): string => {
  if (Number.isNaN(instant.getTime()) || !isSupportedTimezone(timezone)) {
    throw new TimeInputError("INVALID_LOCAL_TIME");
  }

  try {
    return Temporal.Instant
      .from(instant.toISOString())
      .toZonedDateTimeISO(timezone.trim())
      .toPlainDateTime()
      .toString({ smallestUnit: "minute" });
  } catch {
    throw new TimeInputError("INVALID_LOCAL_TIME");
  }
};

export const formatRecordWallTimeInput = (
  instant: Date,
  timezone: string,
): LocalRecordTime => {
  const value = formatRecordWallTime(instant, timezone);
  const { localDate, localTime } = splitRecordWallTime(value);
  const offsets = possibleOffsetsForWallTime({ localDate, localTime, timezone });

  if (offsets.length <= 1) {
    return { value };
  }

  const minuteEpoch = Math.floor(instant.getTime() / 60_000) * 60_000;
  const occurrence = offsets.findIndex((choice) => parseZonedDateTime({
    localDate,
    localTime,
    timezone,
    offsetMinutes: choice.offsetMinutes,
  }).getTime() === minuteEpoch);

  if (occurrence < 0) {
    throw new TimeInputError("INVALID_LOCAL_TIME");
  }

  return {
    value,
    disambiguation: occurrence === 0 ? "earlier" : "later",
  };
};
