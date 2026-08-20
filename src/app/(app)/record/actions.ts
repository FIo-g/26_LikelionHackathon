"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  buildRecordTypeSchema,
  createRecordInputSchema,
  parseCreateRecordInput,
  parseUpdateRecordInput,
  updateRecordInputSchema,
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
  fieldErrors,
});

const createActionSchema = (clock: Clock) => (
  createRecordInputSchema(clock).and(z.object({
    idempotencyKey: z.string().uuid(),
  }))
);

const updateActionSchema = (clock: Clock) => (
  updateRecordInputSchema(clock).and(z.object({
    idempotencyKey: z.string().uuid(),
    recordId: z.string().min(1),
  }))
);

const deleteActionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  recordId: z.string().min(1),
  recordType: buildRecordTypeSchema(),
});

const idempotencyKeySchema = z.string().uuid();

const normalizeBatchInput = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("INVALID_BATCH_ITEM");
  }

  return normalizePayload(input as Record<string, unknown>);
};

const parseBatchItems = (clock: Clock, rawItems: readonly unknown[]): SaveRecordBatchCommand["items"] => {
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

    const inputShape = normalizeBatchInput({
      ...normalized,
      clientKey: undefined,
      recordId: undefined,
    });

    const input = parseCreateRecordInput(clock, inputShape);

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
  const parsed = createActionSchema(actionClock).safeParse(values);

  if (!parsed.success) {
    return actionError(formData, parsed.error.flatten().fieldErrors);
  }

  try {
    const { idempotencyKey, ...rest } = parsed.data;
    const result = await recordService(scope).create({
      idempotencyKey,
      input: parseCreateRecordInput(actionClock, rest),
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
  const parsed = updateActionSchema(actionClock).safeParse(values);

  if (!parsed.success) {
    return actionError(formData, parsed.error.flatten().fieldErrors);
  }

  try {
    const { idempotencyKey, recordId, ...rest } = parsed.data;
    const result = await recordService(scope).update({
      idempotencyKey,
      recordId,
      input: parseUpdateRecordInput(actionClock, rest),
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

  if (!idempotencyKeySchema.safeParse(idempotencyKey).success) {
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
    const items = parseBatchItems(actionClock, parsedItems);
    const result = await recordService(scope).saveBatch({
      idempotencyKey,
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

  if (!idempotencyKeySchema.safeParse(idempotencyKey).success) {
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
    return actionError(formData, parsed.error.flatten().fieldErrors as Record<string, readonly string[]>);
  }

  try {
    const result = await recordService(scope).deleteBatch({
      idempotencyKey,
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
