import { SpeedTestError } from "./types.js";
import { throwForHttpStatus } from "./httpErrors.js";

export interface FetchTimeoutInit extends RequestInit {
  timeoutMs: number;
}

/**
 * fetch() wrapper with a real timeout (via AbortController) that also
 * respects an externally supplied AbortSignal (test cancellation).
 * Works identically in Node 18+ (undici) and every modern browser.
 */
export async function fetchWithTimeout(
  url: string,
  init: FetchTimeoutInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);

  const onExternalAbort = () => controller.abort();
  init.signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throwForHttpStatus(response.status, new URL(url).host);
    }
    return response;
  } catch (err) {
    if (init.signal?.aborted) {
      throw new SpeedTestError("CANCELLED", "Test was cancelled");
    }
    if (controller.signal.aborted) {
      throw new SpeedTestError(
        "TIMEOUT",
        `Request to ${new URL(url).host} timed out`,
        "Check your network connection or try a different server.",
      );
    }
    if (err instanceof SpeedTestError) throw err;
    throw new SpeedTestError(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "Unknown network error",
      "Verify you have an active internet connection and the server is reachable.",
    );
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", onExternalAbort);
  }
}

export function isOnline(): boolean {
  // navigator.onLine exists in browsers; Node has no equivalent, so we
  // optimistically assume connectivity and let the actual test calls
  // surface a real NETWORK_ERROR if there is none.
  const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
  return nav?.onLine ?? true;
}
