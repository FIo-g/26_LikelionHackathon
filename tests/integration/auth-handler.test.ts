import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { createAuth } from "@/shared/auth/auth";

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
});

