import { expect, it } from "vitest";

import { createDatabaseReadinessProbe } from "@/shared/db/readiness";

it("returns false after aborting a bounded database probe without exposing its failure", async () => {
  const probe = createDatabaseReadinessProbe((signal) => new Promise<void>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("database details must stay private")), { once: true });
  }));

  await expect(probe(1)).resolves.toBe(false);
});

it("returns true for a successful bounded database probe", async () => {
  const probe = createDatabaseReadinessProbe(async () => undefined);

  await expect(probe(100)).resolves.toBe(true);
});
