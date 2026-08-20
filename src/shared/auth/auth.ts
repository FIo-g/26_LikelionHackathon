import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { getPrismaClient } from "@/shared/db/prisma";
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

export const createAuth = (environment: AuthEnvironment = process.env) => {
  const databaseUrl = environment.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const secret = environment.BETTER_AUTH_SECRET?.trim() ?? "";
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required");

  const authOrigin = resolveAuthOrigin(environment);
  const prisma = getPrismaClient();

  return betterAuth({
    database: prismaAdapter(prisma, { provider: providerForUrl(databaseUrl) }),
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
  authInstance ??= createAuth();
  return authInstance;
};
