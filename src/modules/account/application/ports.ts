import type { ConnectionAvailability, ConnectionMode, ConnectionState } from "@/shared/connection/status";
import type { UserScope } from "@/shared/domain/contracts";
import type { HabitValues, ProfileDetails, ProfileInput } from "@/modules/onboarding/domain/types";

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

/** Values read from the user-scoped onboarding habit row for Account. */
export type AccountHabitData = Readonly<{
  caffeine: HabitValues["caffeine"];
  exercise: HabitValues["exercise"];
  meal: HabitValues["meal"];
  alcohol: NonNullable<HabitValues["alcohol"]> | null;
  phoneUsage: HabitValues["phoneUsage"];
}>;

export type AccountData = Readonly<{
  identity: Readonly<{ email: string | null }>;
  profile: ProfileDetails;
  habits: AccountHabitData | null;
  sleepGoal: Readonly<{ targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number }>;
  connections: readonly AccountConnection[];
  manualInputCategories: readonly ManualInputCategory[];
}>;

export type AccountViewModel = AccountData & Readonly<{
  dataManagement: Readonly<{ exportRequiresReauth: true; deleteRequiresReauth: true }>;
}>;

export interface AccountRepository {
  getViewModelData(scope: UserScope): Promise<AccountData>;
  updateProfile(scope: UserScope, input: ProfileInput): Promise<void>;
  updateSleepGoal(scope: UserScope, input: Readonly<{ targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number }>): Promise<void>;
}
