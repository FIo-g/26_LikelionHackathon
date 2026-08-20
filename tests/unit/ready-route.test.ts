import { expect, it, vi } from "vitest";

const probeDatabaseReadiness = vi.fn<() => Promise<boolean>>();
vi.mock("@/shared/db/readiness", () => ({ probeDatabaseReadiness }));

import { GET } from "@/app/api/ready/route";

it("returns only a generic ready status when the database probe succeeds", async () => {
  probeDatabaseReadiness.mockResolvedValueOnce(true);

  const response = await GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ready" });
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("fails closed without database details when the probe is unavailable", async () => {
  probeDatabaseReadiness.mockResolvedValueOnce(false);

  const response = await GET();

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({ status: "unavailable" });
});
