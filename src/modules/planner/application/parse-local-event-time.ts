import { Temporal } from "@js-temporal/polyfill";

const matchesLocalTime = (value: Temporal.ZonedDateTime, local: Temporal.PlainDateTime): boolean => (
  value.toPlainDateTime().equals(local)
);

export const parseUnambiguousLocalEventTime = (value: string, timezone: string): string => {
  const local = Temporal.PlainDateTime.from(value);
  const earlier = local.toZonedDateTime(timezone, { disambiguation: "earlier" });
  const later = local.toZonedDateTime(timezone, { disambiguation: "later" });

  if (!matchesLocalTime(earlier, local) || !matchesLocalTime(later, local)) {
    throw new Error("NONEXISTENT_LOCAL_TIME");
  }
  if (earlier.epochNanoseconds !== later.epochNanoseconds) {
    throw new Error("AMBIGUOUS_LOCAL_TIME");
  }

  return earlier.toInstant().toString();
};
