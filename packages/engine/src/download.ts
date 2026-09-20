import type { ThroughputResult, ThroughputSample } from "./types.js";
import { runTransfer, createGuardedSignal } from "./transfer.js";
import { throwForHttpStatus } from "./httpErrors.js";

export interface DownloadOptions {
  urlFor: (bytes: number) => string;
  durationMs: number;
  connections: number;
  timeoutMs: number;
  signal?: AbortSignal;
  onSample?: (sample: ThroughputSample) => void;
  /** Bytes requested per HTTP request; re-issued as needed to fill the duration. */
  chunkBytes?: number;
}

/**
 * Real download throughput measurement: N concurrent GET streams reading
 * the response body chunk-by-chunk, counting every byte as it actually
 * arrives over the network. No portion of the reported number is derived
 * from Content-Length alone — a stalled or truncated stream shows up as
 * lower throughput, exactly as it should.
 */
export async function measureDownload(
  opts: DownloadOptions,
): Promise<ThroughputResult> {
  const chunkBytes = opts.chunkBytes ?? 25_000_000;

  return runTransfer({
    connections: opts.connections,
    durationMs: opts.durationMs,
    signal: opts.signal,
    onSample: opts.onSample,
    startRequest: async (signal, onBytes) => {
      const guard = createGuardedSignal(signal, opts.timeoutMs);
      let response: Response;
      try {
        response = await fetch(opts.urlFor(chunkBytes), {
          method: "GET",
          cache: "no-store",
          signal: guard.signal,
        });
      } finally {
        guard.settled();
      }
      if (!response.ok) {
        throwForHttpStatus(
          response.status,
          new URL(opts.urlFor(chunkBytes)).host,
        );
      }
      if (!response.body) {
        throw new Error("Download response had no body");
      }
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) onBytes(value.byteLength);
        }
      } finally {
        reader.releaseLock();
      }
    },
  });
}
