import { NarrationProviderError } from "@/modules/narration/domain/types";

export async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new NarrationProviderError("TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
