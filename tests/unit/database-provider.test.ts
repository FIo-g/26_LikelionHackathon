import { describe, expect, it } from "vitest";
import { providerForUrl } from "@/shared/db/database-provider";

describe("providerForUrl", () => {
  it("classifies SQLite file URLs as sqlite", () => {
    expect(providerForUrl("file:./dev.db")).toBe("sqlite");
    expect(providerForUrl("file:./prisma/contract.db")).toBe("sqlite");
  });

  it("classifies PostgreSQL URLs as postgresql", () => {
    expect(providerForUrl("postgresql://user:pass@localhost:5432/app")).toBe("postgresql");
  });

  it("rejects unsupported providers", () => {
    expect(() => providerForUrl("mysql://user:pass@localhost:3306/app")).toThrow("Unsupported DATABASE_URL provider");
  });

  it("requires a non-empty URL", () => {
    expect(() => providerForUrl("")).toThrow("DATABASE_URL is required");
  });
});

