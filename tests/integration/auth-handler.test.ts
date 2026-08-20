import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AUTH_SESSION_COOKIE, createAuth } from "@/shared/auth/auth";
import { createPrismaClient } from "@/shared/db/prisma";

const sessionCookieFrom = (response: Response): string => {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headers.getSetCookie?.() ?? [headers.get("set-cookie") ?? ""];
  const sessionCookie = setCookies
    .map((value) => value.split(";", 1)[0])
    .find((value) => value.startsWith(`${AUTH_SESSION_COOKIE}=`));
  if (!sessionCookie) throw new Error("auth response did not set a session cookie");
  return sessionCookie;
};

describe("auth route handler", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("surfaces initialization errors while handling an auth request", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    const request = new Request("http://localhost/api/auth/unknown");
    const { GET, POST } = await import("@/app/api/auth/[...all]/route");

    await expect(GET(request)).rejects.toThrow("DATABASE_URL is required");
    await expect(POST(request)).rejects.toThrow("DATABASE_URL is required");
  });

  it("does not replace an initialization error with a configured-looking handler", () => {
    expect(() => createAuth({ DATABASE_URL: "", BETTER_AUTH_SECRET: "" }))
      .toThrow("DATABASE_URL is required");
  });

  it("builds auth from a valid injected database URL instead of process environment", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");

    const auth = createAuth({
      DATABASE_URL: "file:./prisma/injected-auth.sqlite",
      BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
      NODE_ENV: "test",
    });

    expect(auth.handler).toBeTypeOf("function");
  });

  it("isolates two real sessions through the exported auth route and protected guard", async () => {
    const databaseDirectory = await mkdtemp(join(tmpdir(), "adaptive-sleep-auth-test-"));
    const databasePath = join(databaseDirectory, "dedicated-auth-test.sqlite");
    const migration = await readFile(
      "prisma/migrations-sqlite/20260819000000_initial_sqlite/migration.sql",
      "utf8",
    );
    const sqlite = new DatabaseSync(databasePath);
    sqlite.exec(migration);
    sqlite.close();

    const databaseUrl = `file:${databasePath}`;
    const prisma = createPrismaClient(databaseUrl);
    vi.stubEnv("DATABASE_URL", databaseUrl);
    vi.stubEnv("BETTER_AUTH_SECRET", "dedicated-auth-test-secret-at-least-32-characters");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost");
    vi.stubEnv("AUTH_RATE_LIMIT_ENABLED", "false");
    vi.resetModules();
    (globalThis as typeof globalThis & { __prisma?: unknown }).__prisma = undefined;
    const route = await import("@/app/api/auth/[...all]/route");
    const { requireUserScope } = await import("@/shared/auth/require-user-scope");
    const request = async (
      path: string,
      init: { method?: "GET" | "POST"; body?: Record<string, string>; cookie?: string } = {},
    ): Promise<Response> => {
      const method = init.method ?? "GET";
      const headers = new Headers();
      if (init.cookie) headers.set("cookie", init.cookie);
      if (method === "POST") {
        headers.set("content-type", "application/json");
        headers.set("origin", "http://localhost");
      }
      const authRequest = new Request(`http://localhost/api/auth${path}`, {
        method,
        headers,
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      return method === "POST" ? route.POST(authRequest) : route.GET(authRequest);
    };

    try {
      const anonymous = await request("/get-session");
      expect(anonymous.status).toBe(200);
      await expect(anonymous.json()).resolves.toBeNull();

      const aliceSignup = await request("/sign-up/email", {
        method: "POST",
        body: { name: "Alice", email: "auth-alice@example.test", password: "password123" },
      });
      const bobSignup = await request("/sign-up/email", {
        method: "POST",
        body: { name: "Bob", email: "auth-bob@example.test", password: "password123" },
      });
      expect(aliceSignup.status).toBe(200);
      expect(bobSignup.status).toBe(200);
      const aliceCookie = sessionCookieFrom(aliceSignup);
      const bobCookie = sessionCookieFrom(bobSignup);

      const aliceSession = await (await request("/get-session", { cookie: aliceCookie })).json() as { user: { id: string; email: string } };
      const bobSession = await (await request("/get-session", { cookie: bobCookie })).json() as { user: { id: string; email: string } };
      expect(aliceSession.user.email).toBe("auth-alice@example.test");
      expect(bobSession.user.email).toBe("auth-bob@example.test");
      expect(bobSession.user.id).not.toBe(aliceSession.user.id);

      for (const userId of [aliceSession.user.id, bobSession.user.id]) {
        await prisma.userProfile.create({ data: { userId, nickname: userId, timezone: "Asia/Seoul", onboardingCompletedAt: new Date() } });
      }
      await expect(requireUserScope(new Headers({ cookie: aliceCookie }))).resolves.toEqual({ userId: aliceSession.user.id, timezone: "Asia/Seoul" });
      await expect(requireUserScope(new Headers({ cookie: bobCookie }))).resolves.toEqual({ userId: bobSession.user.id, timezone: "Asia/Seoul" });
      await expect(requireUserScope(new Headers())).rejects.toMatchObject({ name: "UnauthorizedError" });

      const signout = await request("/sign-out", { method: "POST", cookie: aliceCookie });
      expect(signout.status).toBe(200);
      await expect(prisma.session.count({ where: { userId: aliceSession.user.id } })).resolves.toBe(0);
      await expect((await request("/get-session", { cookie: aliceCookie })).json()).resolves.toBeNull();

      const signin = await request("/sign-in/email", {
        method: "POST",
        body: { email: "auth-alice@example.test", password: "password123" },
      });
      expect(signin.status).toBe(200);
      const signinCookie = sessionCookieFrom(signin);
      const signedInSession = await (await request("/get-session", { cookie: signinCookie })).json() as {
        user: { id: string; email: string };
      };
      expect(signedInSession.user.id).toBe(aliceSession.user.id);
      expect(signedInSession.user.email).toBe("auth-alice@example.test");
    } finally {
      await prisma.$disconnect();
      const sharedPrisma = (globalThis as typeof globalThis & { __prisma?: { $disconnect: () => Promise<void> } }).__prisma;
      await sharedPrisma?.$disconnect();
      (globalThis as typeof globalThis & { __prisma?: unknown }).__prisma = undefined;
      await rm(databaseDirectory, { recursive: true, force: true });
    }
  });
});

