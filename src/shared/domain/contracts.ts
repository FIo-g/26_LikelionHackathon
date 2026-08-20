export type UserScope = Readonly<{
  userId: string;
  timezone: string;
}>;

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  uuid(): string;
}

export type DisplayState = "ready" | "insufficient" | "stale" | "error";
export type ConfidenceLevel = "insufficient" | "low" | "medium" | "high";

export type VersionedPayload<T extends object> = Readonly<{
  schemaVersion: 1;
} & T>;

export type Evidence = Readonly<{
  code: string;
  label: string;
  direction: "positive" | "negative" | "neutral";
  value: string | number | null;
  count: number | null;
}>;
