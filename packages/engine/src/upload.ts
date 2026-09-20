import type { ThroughputResult, ThroughputSample } from "./types.js";
import { runTransfer, createGuardedSignal } from "./transfer.js";
import { throwForHttpStatus } from "./httpErrors.js";

export interface UploadOptions {
  urlFor: () => string;
  durationMs: number;
  connections: number;
  timeoutMs: number;
  signal?: AbortSignal;
  onSample?: (sample: ThroughputSample) => void;
  /** Total bytes offered per HTTP request; re-issued as needed. */
  requestBytes?: number;
}

const CHUNK_SIZE = 64 * 1024;

function randomChunk(): Uint8Array {
  const chunk = new Uint8Array(CHUNK_SIZE);
  crypto.getRandomValues(chunk);
  return chunk;
}

/**
 * Real upload throughput measurement: N concurrent POST requests whose
 * body is a ReadableStream we produce chunk-by-chunk. Progress is counted
 * as each chunk is pulled by the HTTP stack (`pull()` backpressure means
 * the browser/Node only asks for more data when it is ready to send it),
 * which is the standard technique for tracking upload progress with the
 * Fetch API (fetch does not expose XHR-style `progress` events).
 */
export async function measureUpload(
  opts: UploadOptions,
): Promise<ThroughputResult> {
  const requestBytes = opts.requestBytes ?? 15_000_000;

  return runTransfer({
    connections: opts.connections,
    durationMs: opts.durationMs,
    signal: opts.signal,
    onSample: opts.onSample,
    startRequest: async (signal, onBytes) => {
      let sent = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent >= requestBytes) {
            controller.close();
            return;
          }
          const remaining = requestBytes - sent;
          const chunk =
            remaining < CHUNK_SIZE
              ? randomChunk().slice(0, remaining)
              : randomChunk();
          controller.enqueue(chunk);
          sent += chunk.byteLength;
          onBytes(chunk.byteLength);
        },
      });

      const guard = createGuardedSignal(signal, opts.timeoutMs);
      try {
        const response = await fetch(opts.urlFor(), {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/octet-stream" },
          body,
          // @ts-expect-error duplex is required for streaming bodies (Node 18+/Chrome 105+) but missing from lib.dom types
          duplex: "half",
          signal: guard.signal,
        });
        if (!response.ok) {
          throwForHttpStatus(response.status, new URL(opts.urlFor()).host);
        }
        // Drain the response body (server just returns a small ack JSON).
        await response.arrayBuffer();
      } finally {
        guard.settled();
      }
    },
  });
}
