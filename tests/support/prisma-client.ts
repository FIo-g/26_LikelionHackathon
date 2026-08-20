import { createPrismaClient } from "@/shared/db/prisma";

export const createTestPrismaClient = (databaseUrl = process.env.DATABASE_URL): ReturnType<typeof createPrismaClient> => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return createPrismaClient(databaseUrl);
};
