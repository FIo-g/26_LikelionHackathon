import { betterAuth } from "better-auth";
import { PrismaAdapter } from "@better-auth/prisma-adapter";
import { getPrismaClient } from "@/shared/db/prisma";
import { resolveAuthOrigin } from "@/shared/auth/auth-origin";

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

    return betterAuth({
      database: PrismaAdapter(prisma),
      secret,
      baseURL: authOrigin.baseURL,
      trustedOrigins: authOrigin.trustedOrigins,
      emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        requireEmailVerification: false,
      },
      basePath: "/api/auth",
    });
  } catch {
    return { handler: createFallbackHandler() };
  }
})();
