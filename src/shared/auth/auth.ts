import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient, getPrismaClient } from "@/shared/db/prisma";
import { providerForUrl } from "@/shared/db/database-provider";
import { resolveAuthOrigin } from "@/shared/auth/auth-origin";

export const AUTH_SESSION_COOKIE = "better-auth.session_token";

export type AuthEnvironment = Readonly<{
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  BETTER_AUTH_URL?: string;
  NODE_ENV?: string;
  AUTH_RATE_LIMIT_ENABLED?: string;
}>;

export const createAuth = (environment: AuthEnvironment = process.env, prisma?: PrismaClient) => {
  const databaseUrl = environment.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const secret = environment.BETTER_AUTH_SECRET?.trim() ?? "";
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required");

  const authOrigin = resolveAuthOrigin(environment);
  const database = prisma ?? createPrismaClient(databaseUrl);

  return betterAuth({
    database: prismaAdapter(database, { provider: providerForUrl(databaseUrl) }),
    secret,
    baseURL: authOrigin.baseURL,
    trustedOrigins: authOrigin.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    rateLimit: environment.AUTH_RATE_LIMIT_ENABLED === "true"
      ? { storage: "database" }
      : undefined,
    basePath: "/api/auth",
  });
};

let authInstance: ReturnType<typeof createAuth> | undefined;

export const getAuth = () => {
  authInstance ??= createAuth(process.env, getPrismaClient());
  return authInstance;
};

export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get: (_target, property) => Reflect.get(getAuth(), property, getAuth()),
  has: (_target, property) => property in getAuth(),
  ownKeys: () => Reflect.ownKeys(getAuth()),
  getOwnPropertyDescriptor: (_target, property) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(getAuth(), property);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});
