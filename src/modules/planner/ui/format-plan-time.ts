export const formatPlanTime = (value: string, timezone: string): string => new Intl.DateTimeFormat("en-GB", {
  timeZone: timezone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format(new Date(value));

export const formatPlanDateTime = (value: string, timezone: string): string => new Intl.DateTimeFormat("ko-KR", {
  timeZone: timezone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format(new Date(value));
