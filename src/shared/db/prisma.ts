import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { providerForUrl } from "@/shared/db/database-provider";

const createAdapter = (databaseUrl: string) => {
  const provider = providerForUrl(databaseUrl);

  if (provider === "postgresql") {
    return new PrismaPg({ connectionString: databaseUrl });
  }

  return undefined;
};

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const globalThisWithPrisma = globalThis as typeof globalThis & { __prisma?: PrismaClient };

const logConfig = process.env.NODE_ENV === "development"
  ? { log: ["warn", "error"] as const }
  : { log: ["error"] as const };

const createPrismaClient = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const adapter = createAdapter(databaseUrl);

  return new PrismaClient({
    ...logConfig,
    ...(adapter ? { adapter } : {}),
  });
};

export const getPrismaClient = () => {
  if (!globalThisWithPrisma.__prisma) {
    globalThisWithPrisma.__prisma = createPrismaClient();
  }

  return globalThisWithPrisma.__prisma;
};
