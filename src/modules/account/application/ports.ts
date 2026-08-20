import type { ConnectionAvailability, ConnectionMode, ConnectionState } from "@/shared/connection/status";
import type { UserScope } from "@/shared/domain/contracts";

export type AccountConnection = Readonly<{
  type: "manual" | "wearable" | "phone" | "calendar";
  label: string;
  mode: ConnectionMode;
  availability: ConnectionAvailability;
  state: ConnectionState;
  lastSyncedAt: null;
}>;

export type ManualInputCategory = Readonly<{
  key: "sleep" | "phone" | "caffeine" | "alcohol" | "meal" | "exercise" | "wellness";
  label: string;
}>;

export type AccountData = Readonly<{
  identity: Readonly<{ email: string | null }>;
  profile: Readonly<{ nickname: string; timezone: string }>;
  sleepGoal: Readonly<{ targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number }>;
  connections: readonly AccountConnection[];
  manualInputCategories: readonly ManualInputCategory[];
}>;

export type AccountViewModel = AccountData & Readonly<{
  dataManagement: Readonly<{ exportRequiresReauth: true; deleteRequiresReauth: true }>;
}>;

export interface AccountRepository {
  getViewModelData(scope: UserScope): Promise<AccountData>;
  updateProfile(scope: UserScope, input: Readonly<{ nickname: string; timezone: string }>): Promise<void>;
  updateSleepGoal(scope: UserScope, input: Readonly<{ targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number }>): Promise<void>;
}
