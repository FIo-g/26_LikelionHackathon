import { Pool, type PoolClient } from "pg";

const READINESS_TIMEOUT_MS = 750;

export type AbortableDatabaseProbe = (signal: AbortSignal) => Promise<void>;

export const createDatabaseReadinessProbe = (query: AbortableDatabaseProbe) => async (
  timeoutMs = READINESS_TIMEOUT_MS,
): Promise<boolean> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await query(controller.signal);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

declare global {
  // eslint-disable-next-line no-var
  var __readinessPool: Pool | undefined;
}

const globalWithReadinessPool = globalThis as typeof globalThis & { __readinessPool?: Pool };

const getReadinessPool = (): Pool | null => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.startsWith("postgresql://")) return null;
  if (!globalWithReadinessPool.__readinessPool) {
    globalWithReadinessPool.__readinessPool = new Pool({
      connectionString: databaseUrl,
      max: 1,
      connectionTimeoutMillis: READINESS_TIMEOUT_MS,
      idleTimeoutMillis: READINESS_TIMEOUT_MS,
      allowExitOnIdle: true,
    });
  }
  return globalWithReadinessPool.__readinessPool;
};

const probePool = (pool: Pool): AbortableDatabaseProbe => (signal) => new Promise<void>((resolve, reject) => {
  let client: PoolClient | null = null;
  let settled = false;
  const finish = (error?: Error): void => {
    if (settled) return;
    settled = true;
    signal.removeEventListener("abort", onAbort);
    if (client) client.release(Boolean(error));
    if (error) reject(error);
    else resolve();
  };
  const onAbort = (): void => finish(new Error("DATABASE_READINESS_ABORTED"));
  signal.addEventListener("abort", onAbort, { once: true });
  void pool.connect().then((acquired) => {
    if (settled || signal.aborted) {
      acquired.release(true);
      return;
    }
    client = acquired;
    return client.query("SELECT 1").then(
      () => finish(),
      () => finish(new Error("DATABASE_READINESS_FAILED")),
    );
  }, () => finish(new Error("DATABASE_READINESS_FAILED")));
});

export const probeDatabaseReadiness = async (): Promise<boolean> => {
  const pool = getReadinessPool();
  if (!pool) return false;
  return createDatabaseReadinessProbe(probePool(pool))();
};
