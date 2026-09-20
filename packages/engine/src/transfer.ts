import type { ThroughputResult, ThroughputSample } from "./types.js";
import { SpeedTestError } from "./types.js";
import { bytesToMbps, round } from "./stats.js";

/**
 * Combines an external AbortSignal with a connect/header timeout into a
 * single signal, so a single request that never gets a response doesn't
 * hang forever, without capping the duration of a stream that IS flowing
 * (the timer is cleared once `settled()` is called after headers arrive).
 */
export function createGuardedSignal(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; settled: () => void; dispose: () => void } {
  const local = new AbortController();
  const forward = () => local.abort();
  external?.addEventListener("abort", forward);
  const timer = setTimeout(() => local.abort(), timeoutMs);
  return {
    signal: local.signal,
    settled: () => clearTimeout(timer),
    dispose: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", forward);
    },
  };
}

export interface RunTransferOptions {
  connections: number;
  durationMs: number;
  signal?: AbortSignal;
  sampleIntervalMs?: number;
  startRequest: (
    signal: AbortSignal,
    onBytes: (n: number) => void,
  ) => Promise<void>;
  onSample?: (sample: ThroughputSample) => void;
}

/**
 * Runs `connections` concurrent request loops for `durationMs`, sampling
 * aggregate throughput at a fixed interval. Every byte counted comes from
 * an actual network read/write callback supplied by the caller — nothing
 * here is simulated. A worker that errors backs off and retries its own
 * connection slot; the whole test only fails if zero bytes were ever
 * transferred by any connection.
 */
export async function runTransfer(
  opts: RunTransferOptions,
): Promise<ThroughputResult> {
  const sampleIntervalMs = opts.sampleIntervalMs ?? 100;
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onExternalAbort);
  const durationTimer = setTimeout(() => controller.abort(), opts.durationMs);

  let bytesTotal = 0;
  let peakMbps = 0;
  const samples: ThroughputSample[] = [];
  const start = performance.now();
  let lastSampleBytes = 0;
  let lastSampleT = 0;
  const workerErrors: unknown[] = [];
  let cancelledExternally = false;

  const onBytes = (n: number) => {
    bytesTotal += n;
  };

  const sampleTimer = setInterval(() => {
    const now = performance.now() - start;
    const deltaBytes = bytesTotal - lastSampleBytes;
    const deltaMs = now - lastSampleT;
    const instantMbps = deltaMs > 0 ? bytesToMbps(deltaBytes, deltaMs) : 0;
    const avgMbps = bytesToMbps(bytesTotal, now);
    peakMbps = Math.max(peakMbps, instantMbps);
    lastSampleBytes = bytesTotal;
    lastSampleT = now;
    const sample: ThroughputSample = {
      tMs: round(now, 0),
      instantMbps: round(instantMbps, 2),
      avgMbps: round(avgMbps, 2),
      bytesTotal,
    };
    samples.push(sample);
    opts.onSample?.(sample);
  }, sampleIntervalMs);

  async function worker(): Promise<void> {
    while (!controller.signal.aborted) {
      try {
        await opts.startRequest(controller.signal, onBytes);
      } catch (err) {
        if (controller.signal.aborted) {
          if (opts.signal?.aborted) cancelledExternally = true;
          break;
        }
        workerErrors.push(err);
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }

  await Promise.all(Array.from({ length: opts.connections }, () => worker()));

  clearInterval(sampleTimer);
  clearTimeout(durationTimer);
  opts.signal?.removeEventListener("abort", onExternalAbort);

  const elapsedMs = performance.now() - start;

  if (cancelledExternally) {
    throw new SpeedTestError("CANCELLED", "Test was cancelled");
  }
  if (bytesTotal === 0) {
    // Prefer a specific, already-classified error (e.g. rate limited,
    // server error) over a generic connection-refused-style Error, even
    // if the generic one happened to occur first.
    const classified = workerErrors.find((e) => e instanceof SpeedTestError);
    if (classified) throw classified;
    throw new SpeedTestError(
      "NETWORK_ERROR",
      "Unable to transfer any data to or from the test server",
      "Check your internet connection, or try a different server.",
    );
  }

  const avgMbps = bytesToMbps(bytesTotal, elapsedMs);
  return {
    mbps: round(avgMbps, 2),
    avgMbps: round(avgMbps, 2),
    peakMbps: round(peakMbps, 2),
    bytesTransferred: bytesTotal,
    durationMs: round(elapsedMs, 0),
    connections: opts.connections,
    samples,
  };
}
