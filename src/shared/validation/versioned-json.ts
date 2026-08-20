import { z } from "zod";

import { JsonContractError } from "@/shared/validation/errors";
import type { VersionedPayload } from "@/shared/domain/contracts";

export const MAX_JSON_BYTES = 64 * 1024;

export function assertJsonSize(value: unknown): void {
  let serialized: string | undefined;

  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new JsonContractError("INVALID_JSON_VALUE");
  }

  if (serialized === undefined) {
    throw new JsonContractError("INVALID_JSON_VALUE");
  }

  if (Buffer.byteLength(serialized, "utf8") > MAX_JSON_BYTES) {
    throw new JsonContractError("JSON_TOO_LARGE");
  }
}

export function versionedPayloadSchema<T extends z.ZodRawShape>(payloadShape: T) {
  return z.object({
    schemaVersion: z.literal(1),
    ...payloadShape,
  }).strict();
}

export function parseVersionedJson<T extends Record<string, unknown>>(value: string): VersionedPayload<T> {
  assertJsonSize(value);

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new JsonContractError("INVALID_JSON_VALUE");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new JsonContractError("INVALID_JSON_VALUE");
  }

  if ((parsed as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new JsonContractError("UNKNOWN_SCHEMA_VERSION");
  }

  return parsed as VersionedPayload<T>;
}
