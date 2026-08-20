"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  buildRecordTypeSchema,
  parseCreateRecordInput,
  parseUpdateRecordInput,
} from "@/modules/records/domain/schemas";
import { createAnalysisRepository } from "@/modules/analysis/infrastructure/prisma-analysis-repository";
import {
  createRecordService,
  type DeleteRecordBatchCommand,
  type SaveRecordBatchCommand,
  type RecordActionState,
} from "@/modules/records/application/record-service";
import { requireUserScope } from "@/shared/auth/require-user-scope";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import {
  parseRecordWallTime,
  type LocalRecordTime,
  type WallTimeDisambiguation,
} from "@/shared/time/zoned-date-time";

const numericFields = new Set([
  "morningFatigue",
  "caffeineMg",
  "servings",
  "durationMinutes",
  "fatigueLevel",
  "stressLevel",
  "averageHeartRate",
]);

const actionClock: Clock = {
  now: () => new Date(),
};

const recordService = (scope: Parameters<typeof createRecordService>[0]) => createRecordService(scope, {
  analysisRepositoryFactory: createAnalysisRepository,
});

const normalizeNumberField = (field: string, value: string): unknown => {
  if (!numericFields.has(field)) {
    return value;
  }

  if (field === "averageHeartRate" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const normalizePayload = (payload: Record<string, unknown>): Record<string, unknown> => (
  Object.entries(payload).reduce((acc, [key, value]) => {
    acc[key] = (typeof value === "string") ? normalizeNumberField(key, value) : value;
    return acc;
  }, {} as Record<string, unknown>)
);

const valuesFromForm = (formData: FormData): Record<string, unknown> => (
  normalizePayload(
    Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [
      key,
      typeof value === "string" ? value : "",
    ])) as Record<string, unknown>,
  )
);

const actionError = (
  formData: FormData,
  fieldErrors: Record<string, readonly string[]>,
): RecordActionState => ({
  status: "error",
  values: Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [
    key,
    typeof value === "string" ? value : "",
  ])) as Record<string, string>,
  fieldErrors: Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [field, [...messages]]),
  ),
});

const deleteActionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  recordId: z.string().min(1),
  recordType: buildRecordTypeSchema(),
});

const idempotencyKeySchema = z.string().uuid();

const recordIdSchema = z.string().min(1);

const wallTimeFields = [
  "startedAt",
  "endedAt",
  "consumedAt",
  "eatenAt",
  "lastUseAt",
] as const;

const isWallTimeDisambiguation = (value: unknown): value is WallTimeDisambiguation => (
  value === "earlier" || value === "later"
);

const normalizeRecordWallTimes = (
  input: Record<string, unknown>,
  timezone: string,
): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...input, timezone };

  for (const field of wallTimeFields) {
    const value = normalized[field];
    if (typeof value !== "string") {
      continue;
    }

    const disambiguationValue = normalized[`${field}Disambiguation`];
    const localTime: LocalRecordTime = {
      value,
      ...(isWallTimeDisambiguation(disambiguationValue)
        ? { disambiguation: disambiguationValue }
        : {}),
    };
    normalized[field] = parseRecordWallTime(localTime, timezone);
    delete normalized[`${field}Disambiguation`];
  }

  return normalized;
};

const normalizeBatchInput = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("INVALID_BATCH_ITEM");
  }

  return normalizePayload(input as Record<string, unknown>);
};

const parseBatchItems = (
  clock: Clock,
  timezone: string,
  rawItems: readonly unknown[],
): SaveRecordBatchCommand["items"] => {
  const items = rawItems.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`INVALID_BATCH_ITEM_${index}`);
    }

    const normalized = raw as Record<string, unknown>;
    const clientKey = normalized.clientKey;
    const recordId = normalized.recordId;

    if (typeof clientKey !== "string" || clientKey.trim() === "") {
      throw new Error(`INVALID_CLIENT_KEY_${index}`);
    }

    const inputShape = { ...normalized };
    delete inputShape.clientKey;
    delete inputShape.recordId;

    const input = parseCreateRecordInput(
      clock,
      normalizeRecordWallTimes(normalizeBatchInput(inputShape), timezone),
    );

    return {
      clientKey,
      recordId: typeof recordId === "string" && recordId.trim() !== "" ? recordId : null,
      input,
    } satisfies SaveRecordBatchCommand["items"][number];
  });

  return items;
};

const revalidateRecordViews = () => {
  revalidatePath("/record");
  revalidatePath("/today");
  revalidatePath("/analyze");
  revalidatePath("/plan");
};
const toServiceScope = async (): Promise<UserScope> => requireUserScope();

export async function createRecordAction(formData: FormData): Promise<RecordActionState> {
  const scope = await toServiceScope();
  const values = valuesFromForm(formData);
  const parsedKey = idempotencyKeySchema.safeParse(values.idempotencyKey);

  if (!parsedKey.success) {
    return actionError(formData, { idempotencyKey: ["Invalid idempotencyKey"] });
  }

  try {
    const rest = { ...values };
    delete rest.idempotencyKey;
    const input = parseCreateRecordInput(
      actionClock,
      normalizeRecordWallTimes(rest, scope.timezone),
    );
    const result = await recordService(scope).create({
      idempotencyKey: parsedKey.data,
      input,
    });

    revalidateRecordViews();
    return {
      status: "success",
      recordId: result.recordId,
    };
  } catch (error) {
    return actionError(formData, {
      _form: [String((error as Error).message ?? "Failed")],
    });
  }
}

export async function updateRecordAction(formData: FormData): Promise<RecordActionState> {
  const scope = await toServiceScope();
  const values = valuesFromForm(formData);
  const parsedKey = idempotencyKeySchema.safeParse(values.idempotencyKey);
  const parsedRecordId = recordIdSchema.safeParse(values.recordId);

  if (!parsedKey.success || !parsedRecordId.success) {
    return actionError(formData, {
      ...(!parsedKey.success ? { idempotencyKey: ["Invalid idempotencyKey"] } : {}),
      ...(!parsedRecordId.success ? { recordId: ["Invalid recordId"] } : {}),
    });
  }

  try {
    const rest = { ...values };
    delete rest.idempotencyKey;
    delete rest.recordId;
    const input = parseUpdateRecordInput(
      actionClock,
      normalizeRecordWallTimes(rest, scope.timezone),
    );
    const result = await recordService(scope).update({
      idempotencyKey: parsedKey.data,
      recordId: parsedRecordId.data,
      input,
    });

    revalidateRecordViews();
    return {
      status: "success",
      recordId: result.recordId,
    };
  } catch (error) {
    return actionError(formData, {
      _form: [String((error as Error).message ?? "Failed")],
    });
  }
}

export async function deleteRecordAction(formData: FormData): Promise<RecordActionState> {
  const scope = await toServiceScope();
  const values = valuesFromForm(formData);
  const parsed = deleteActionSchema.safeParse(values);

  if (!parsed.success) {
    return actionError(formData, parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await recordService(scope).delete({
      idempotencyKey: parsed.data.idempotencyKey,
      recordId: parsed.data.recordId,
      recordType: parsed.data.recordType,
    });

    revalidateRecordViews();
    return {
      status: "success",
      recordId: result.recordId,
    };
  } catch (error) {
    return actionError(formData, {
      _form: [String((error as Error).message ?? "Failed")],
    });
  }
}

export async function saveRecordBatchAction(formData: FormData): Promise<RecordActionState> {
  const scope = await toServiceScope();
  const values = valuesFromForm(formData);

  const idempotencyKey = values.idempotencyKey;
  const rawItems = values.items;

  const parsedKey = idempotencyKeySchema.safeParse(idempotencyKey);
  if (!parsedKey.success) {
    return actionError(formData, { idempotencyKey: ["Invalid idempotencyKey"] });
  }

  if (typeof rawItems !== "string") {
    return actionError(formData, { items: ["Invalid items payload"] });
  }

  let parsedItems: unknown;
  try {
    parsedItems = JSON.parse(rawItems);
  } catch {
    return actionError(formData, { items: ["Invalid items payload"] });
  }

  if (!Array.isArray(parsedItems)) {
    return actionError(formData, { items: ["Invalid items payload"] });
  }

  try {
    const items = parseBatchItems(actionClock, scope.timezone, parsedItems);
    const result = await recordService(scope).saveBatch({
      idempotencyKey: parsedKey.data,
      items,
    });

    revalidateRecordViews();
    return {
      status: "success",
      recordId: result.records[0]?.recordId ?? "",
    };
  } catch (error) {
    return actionError(formData, {
      _form: [String((error as Error).message ?? "Failed")],
    });
  }
}

export async function deleteRecordBatchAction(formData: FormData): Promise<RecordActionState> {
  const scope = await toServiceScope();
  const values = valuesFromForm(formData);

  const idempotencyKey = values.idempotencyKey;
  const rawItems = values.items;
  const deleteBatchSchema = z.array(
    z.object({
      recordId: z.string().min(1),
      recordType: buildRecordTypeSchema(),
    }),
  );

  const parsedKey = idempotencyKeySchema.safeParse(idempotencyKey);
  if (!parsedKey.success) {
    return actionError(formData, { idempotencyKey: ["Invalid idempotencyKey"] });
  }

  if (typeof rawItems !== "string") {
    return actionError(formData, { items: ["Invalid items payload"] });
  }

  let parsedItems: unknown;
  try {
    parsedItems = JSON.parse(rawItems);
  } catch {
    return actionError(formData, { items: ["Invalid items payload"] });
  }

  const parsed = deleteBatchSchema.safeParse(parsedItems);
  if (!parsed.success) {
    return actionError(formData, { items: parsed.error.issues.map((issue) => issue.message) });
  }

  try {
    const result = await recordService(scope).deleteBatch({
      idempotencyKey: parsedKey.data,
      items: parsed.data as DeleteRecordBatchCommand["items"],
    });

    revalidateRecordViews();
    return {
      status: "success",
      recordId: result.records[0]?.recordId ?? "",
    };
  } catch (error) {
    return actionError(formData, {
      _form: [String((error as Error).message ?? "Failed")],
    });
  }
}
