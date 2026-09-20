import type { LatencyResult } from "./types.js";
import { jitter, mean, median, round } from "./stats.js";
import { fetchWithTimeout } from "./http.js";

export interface LatencyOptions {
  url: string;
  samples: number;
  timeoutMs: number;
  signal?: AbortSignal;
  onSample?: (index: number, ms: number | null) => void;
}

/**
 * Measures round-trip latency with `samples` independent HTTPS requests to a
 * zero-byte endpoint. This is an application-layer (TCP/TLS request-response)
 * measurement, not an ICMP echo ("ping") — Node and browsers cannot send raw
 * ICMP without elevated OS privileges and a native addon, so we measure what
 * every real HTTP-based speed test measures: time-to-first-byte over HTTPS.
 * This is clearly labeled in the result (`method: "https-round-trip"`) and
 * in the UI rather than presented as a raw ICMP ping.
 */
export async function measureLatency(
  opts: LatencyOptions,
): Promise<LatencyResult> {
  const samples: number[] = [];
  let lost = 0;

  for (let i = 0; i < opts.samples; i++) {
    if (opts.signal?.aborted) break;
    const start = performance.now();
    try {
      await fetchWithTimeout(opts.url, {
        method: "GET",
        cache: "no-store",
        signal: opts.signal,
        timeoutMs: opts.timeoutMs,
      });
      const elapsed = performance.now() - start;
      samples.push(elapsed);
      opts.onSample?.(i, elapsed);
    } catch {
      lost++;
      opts.onSample?.(i, null);
    }
    // Small spacing between probes avoids bursting the connection and
    // gives a fairer idle-latency reading than back-to-back requests.
    if (i < opts.samples - 1) await sleep(40);
  }

  if (samples.length === 0) {
    return {
      minMs: 0,
      avgMs: 0,
      maxMs: 0,
      medianMs: 0,
      jitterMs: 0,
      samples: [],
      packetsSent: opts.samples,
      packetsLost: lost,
      lossPercent: 100,
      method: "https-round-trip",
    };
  }

  return {
    minMs: round(Math.min(...samples), 2),
    avgMs: round(mean(samples), 2),
    maxMs: round(Math.max(...samples), 2),
    medianMs: round(median(samples), 2),
    jitterMs: round(jitter(samples), 2),
    samples: samples.map((s) => round(s, 2)),
    packetsSent: opts.samples,
    packetsLost: lost,
    lossPercent: round((lost / opts.samples) * 100, 2),
    method: "https-round-trip",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
