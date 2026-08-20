import { z } from "zod";

import type { AnalysisResult } from "@/modules/analysis/domain/types";
import type { CareToolKey } from "@/modules/care/domain/tool-catalog";
import type { NarrationOutput } from "@/modules/narration/domain/types";
import type { PlanDayTarget, ScheduleAdviceEntity, SleepPlanEntity } from "@/modules/planner/domain/types";
import type { RecordType, SerializedRecord } from "@/modules/records/domain/types";
import type { AccountData } from "../application/ports";
import type { VersionedPayload } from "@/shared/domain/contracts";
import { versionedPayloadSchema } from "@/shared/validation/versioned-json";
import { resolveAuthOrigin } from "@/shared/auth/auth-origin";

export const exportRequestSchema = z.object({
  password: z.string().min(8).max(128).nullable(),
}).strict();

export type UserDataExport = VersionedPayload<{
  exportedAt: string;
  identity: { email: string; createdAt: string };
  profile: AccountData["profile"];
  sleepGoal: AccountData["sleepGoal"];
  habits: readonly { category: string; value: string | null }[];
  connections: AccountData["connections"];
  records: readonly SerializedRecord[];
  recordRevisions: readonly {
    entityType: RecordType;
    entityId: string;
    operation: "create" | "update" | "delete";
    before: VersionedPayload<{ record: SerializedRecord }> | null;
    after: VersionedPayload<{ record: SerializedRecord }> | null;
    changedAt: string;
  }[];
  planner: {
    events: readonly { id: string; type: string; startsAt: string; desiredWakeAt: string | null }[];
    plans: readonly SleepPlanEntity[];
    advice: readonly ScheduleAdviceEntity[];
    revisions: readonly { id: string; planId: string; before: VersionedPayload<{ days: readonly PlanDayTarget[] }>; after: VersionedPayload<{ days: readonly PlanDayTarget[] }>; createdAt: string }[];
  };
  analyses: readonly { localDate: string; result: AnalysisResult }[];
  narrations: readonly { targetId: string; status: "ready" | "template-fallback"; output: VersionedPayload<NarrationOutput> }[];
  care: {
    routineCompletions: readonly { localDate: string; stepKey: string; completedAt: string }[];
    toolSessions: readonly { localDate: string; toolKey: CareToolKey; startedAt: string; plannedDurationSeconds: number; completedAt: string | null }[];
  };
}>;

export const serializedRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  type: z.enum(["sleep", "caffeine", "alcohol", "meal", "exercise", "phone-usage", "wellness"]),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fields: z.record(z.string(), z.union([z.string(), z.number().finite(), z.null()])),
}).strict() as z.ZodType<SerializedRecord>;

export const recordRevisionEnvelopeSchema = versionedPayloadSchema({ record: serializedRecordSchema }) as z.ZodType<VersionedPayload<{ record: SerializedRecord }>>;

export class CorruptStoredPayloadError extends Error {
  readonly code = "CORRUPT_STORED_PAYLOAD";

  constructor() {
    super("Stored account data could not be exported safely");
    this.name = "CorruptStoredPayloadError";
  }
}

export class ReauthenticationError extends Error {
  readonly code = "REAUTHENTICATION_REQUIRED";

  constructor() {
    super("Recent authentication is required");
    this.name = "ReauthenticationError";
  }
}

export class InvalidMutationOriginError extends Error {
  readonly code = "INVALID_MUTATION_ORIGIN";

  constructor() {
    super("The request origin is not trusted");
    this.name = "InvalidMutationOriginError";
  }
}

export class AccountDeletionConfirmationError extends Error {
  readonly code = "ACCOUNT_DELETION_CONFIRMATION_MISMATCH";

  constructor() {
    super("The deletion confirmation does not match");
    this.name = "AccountDeletionConfirmationError";
  }
}

export class AccountDeletionRaceError extends Error {
  readonly code = "ACCOUNT_DELETION_RACE";

  constructor() {
    super("The account could not be deleted safely");
    this.name = "AccountDeletionRaceError";
  }
}

export const assertTrustedMutationOrigin = (origin: string | null): void => {
  try {
    const trustedOrigins = resolveAuthOrigin(process.env).trustedOrigins;
    if (!origin || !trustedOrigins.includes(new URL(origin).origin)) throw new Error("UNTRUSTED_ORIGIN");
  } catch {
    throw new InvalidMutationOriginError();
  }
};
