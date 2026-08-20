import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { providerForUrl } from "@/shared/db/database-provider";

declare global {
  var __prisma: PrismaClient | undefined;
}

const globalThisWithPrisma = globalThis as typeof globalThis & { __prisma?: PrismaClient };

const logConfig = process.env.NODE_ENV === "development"
  ? { log: ["warn", "error"] as const }
  : { log: ["error"] as const };

export const createPrismaClient = (databaseUrl: string): PrismaClient => {
  const provider = providerForUrl(databaseUrl);
  const adapter = provider === "postgresql"
    ? new PrismaPg({ connectionString: databaseUrl })
    : new PrismaBetterSqlite3({ url: databaseUrl });

  return new PrismaClient({
    ...logConfig,
    adapter,
  });
};

export const getPrismaClient = () => {
  if (!globalThisWithPrisma.__prisma) {
    globalThisWithPrisma.__prisma = createPrismaClient(process.env.DATABASE_URL ?? "");
  }

  return globalThisWithPrisma.__prisma;
};
