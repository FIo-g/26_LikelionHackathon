import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET, POST } from "@/app/api/auth/[...all]/route";
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

  it("persists signup, session, signout, and signin through real auth requests", async () => {
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
    const auth = createAuth({
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: "dedicated-auth-test-secret-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost",
      AUTH_RATE_LIMIT_ENABLED: "false",
      NODE_ENV: "test",
    }, prisma);
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
      return auth.handler(new Request(`http://localhost/api/auth${path}`, {
        method,
        headers,
        body: init.body ? JSON.stringify(init.body) : undefined,
      }));
    };

    try {
      const anonymous = await request("/get-session");
      expect(anonymous.status).toBe(200);
      await expect(anonymous.json()).resolves.toBeNull();

      const signup = await request("/sign-up/email", {
        method: "POST",
        body: { name: "Auth Owner", email: "auth-owner@example.test", password: "password123" },
      });
      expect(signup.status).toBe(200);
      const signupCookie = sessionCookieFrom(signup);

      const protectedSession = await request("/get-session", { cookie: signupCookie });
      expect(protectedSession.status).toBe(200);
      const sessionBody = await protectedSession.json() as { user: { id: string; email: string } };
      expect(sessionBody.user.email).toBe("auth-owner@example.test");
      await expect(prisma.session.findMany({ where: { userId: sessionBody.user.id } }))
        .resolves.toHaveLength(1);

      const foreignSession = await request("/get-session", {
        cookie: `${AUTH_SESSION_COOKIE}=not-the-owner-session`,
      });
      await expect(foreignSession.json()).resolves.toBeNull();

      const signout = await request("/sign-out", { method: "POST", cookie: signupCookie });
      expect(signout.status).toBe(200);
      await expect(prisma.session.count({ where: { userId: sessionBody.user.id } })).resolves.toBe(0);
      await expect((await request("/get-session", { cookie: signupCookie })).json()).resolves.toBeNull();

      const signin = await request("/sign-in/email", {
        method: "POST",
        body: { email: "auth-owner@example.test", password: "password123" },
      });
      expect(signin.status).toBe(200);
      const signinCookie = sessionCookieFrom(signin);
      const signedInSession = await (await request("/get-session", { cookie: signinCookie })).json() as {
        user: { id: string; email: string };
      };
      expect(signedInSession.user.id).toBe(sessionBody.user.id);
      expect(signedInSession.user.email).toBe("auth-owner@example.test");
    } finally {
      await prisma.$disconnect();
      await rm(databaseDirectory, { recursive: true, force: true });
    }
  });
});

