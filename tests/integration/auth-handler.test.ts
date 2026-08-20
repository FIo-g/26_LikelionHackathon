import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { createAuth } from "@/shared/auth/auth";

describe("auth route handler", () => {
  it("surfaces initialization errors while handling an auth request", async () => {
    const request = new Request("http://localhost/api/auth/unknown");

    await expect(GET(request)).rejects.toThrow("DATABASE_URL is required");
    await expect(POST(request)).rejects.toThrow("DATABASE_URL is required");
  });

  it("does not replace an initialization error with a configured-looking handler", () => {
    expect(() => createAuth({ DATABASE_URL: "", BETTER_AUTH_SECRET: "" }))
      .toThrow("DATABASE_URL is required");
  });
});

