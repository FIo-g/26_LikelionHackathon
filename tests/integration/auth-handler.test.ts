import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";

describe("auth route handler", () => {
  it("exports GET and POST handlers", () => {
    expect(GET).toBeTypeOf("function");
    expect(POST).toBeTypeOf("function");
  });
});

