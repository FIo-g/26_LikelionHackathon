import { betterAuth } from "better-auth";
import * as betterAuthPrismaAdapter from "@better-auth/prisma-adapter";
import { getPrismaClient } from "@/shared/db/prisma";
import { resolveAuthOrigin } from "@/shared/auth/auth-origin";

export const AUTH_SESSION_COOKIE = "better-auth.session_token";

const createFallbackHandler = () => ({
  GET: async () => new Response("Authentication is not configured.", { status: 500 }),
  POST: async () => new Response("Authentication is not configured.", { status: 500 }),
});

export const auth = (() => {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!databaseUrl || !secret) {
      return { handler: createFallbackHandler() };
    }

    const authOrigin = resolveAuthOrigin({
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      NODE_ENV: process.env.NODE_ENV,
    });

    const prisma = getPrismaClient();
    const Adapter = (betterAuthPrismaAdapter as Record<string, unknown>).prismaAdapter
      ?? (betterAuthPrismaAdapter as Record<string, unknown>).PrismaAdapter;
    if (typeof Adapter !== "function") {
      throw new Error("Unsupported better-auth prisma adapter export");
    }

    return betterAuth({
      database: (Adapter as (client: unknown) => unknown)(prisma),
      secret,
      baseURL: authOrigin.baseURL,
      trustedOrigins: authOrigin.trustedOrigins,
      emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        requireEmailVerification: false,
      },
      rateLimit: process.env.AUTH_RATE_LIMIT_ENABLED === "true"
        ? { storage: "database" }
        : undefined,
      basePath: "/api/auth",
    });
  } catch {
    return { handler: createFallbackHandler() };
  }
})();
