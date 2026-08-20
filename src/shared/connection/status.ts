export type ConnectionMode = "manual" | "automatic";

export type ConnectionAvailability = "available" | "coming-soon";

export type ConnectionState =
  | "needs-input"
  | "complete"
  | "syncing"
  | "error"
  | "unavailable";

export type ManualConnectionStatus = Readonly<{
  mode: "manual";
  availability: "available";
  state: "needs-input" | "complete";
  lastSyncedAt: null;
}>;

export type AutomaticConnectionStatus = Readonly<{
  mode: "automatic";
  availability: "coming-soon";
  state: "unavailable";
  lastSyncedAt: null;
}>;

export type ConnectionStatus = ManualConnectionStatus | AutomaticConnectionStatus;

