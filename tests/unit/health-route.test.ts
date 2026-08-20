import { expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

it("returns a non-sensitive, non-cacheable liveness response", async () => {
  const response = await GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
