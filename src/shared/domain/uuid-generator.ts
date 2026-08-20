import type { IdGenerator } from "@/shared/domain/contracts";

export const uuidGenerator: IdGenerator = {
  uuid: () => crypto.randomUUID(),
};
