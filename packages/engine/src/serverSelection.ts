import type { SelectedServer, TestServer } from "./types.js";
import { SpeedTestError } from "./types.js";
import {
  BUILTIN_SERVERS,
  findServer,
  parseCloudflareTrace,
  urlsFor,
} from "./servers.js";
import { fetchWithTimeout } from "./http.js";
import { mean, round } from "./stats.js";

export interface ServerSelectionOptions {
  serverId?: string;
  customServers?: TestServer[];
  timeoutMs: number;
  probesPerServer?: number;
  signal?: AbortSignal;
}

async function probeLatency(
  server: TestServer,
  timeoutMs: number,
  probes: number,
  signal?: AbortSignal,
): Promise<number | null> {
  const url = urlsFor(server).latency();
  const samples: number[] = [];
  for (let i = 0; i < probes; i++) {
    const start = performance.now();
    try {
      await fetchWithTimeout(url, {
        method: "GET",
        cache: "no-store",
        timeoutMs,
        signal,
      });
      samples.push(performance.now() - start);
    } catch {
      // ignore a single failed probe; server may still be usable
    }
  }
  return samples.length > 0 ? mean(samples) : null;
}

/**
 * Selects the best available test server by probing round-trip latency to
 * every candidate and picking the lowest. With the default single built-in
 * provider (Cloudflare's anycast edge) this degenerates to "confirm the
 * anycast edge is reachable", but the same code path drives real selection
 * once self-hosted servers are added in Settings.
 */
export async function selectServer(
  opts: ServerSelectionOptions,
): Promise<SelectedServer> {
  const candidates = opts.serverId
    ? [findServer(opts.serverId, opts.customServers)].filter(
        (s): s is TestServer => Boolean(s),
      )
    : [...BUILTIN_SERVERS, ...(opts.customServers ?? [])];

  if (candidates.length === 0) {
    throw new SpeedTestError(
      "SERVER_NOT_FOUND",
      opts.serverId
        ? `No server found with id "${opts.serverId}"`
        : "No test servers are configured",
      "Use automatic server selection or add a server in Settings.",
    );
  }

  const probes = opts.probesPerServer ?? 3;
  const results = await Promise.all(
    candidates.map(async (server) => ({
      server,
      latency: await probeLatency(server, opts.timeoutMs, probes, opts.signal),
    })),
  );

  const reachable = results.filter((r) => r.latency !== null) as {
    server: TestServer;
    latency: number;
  }[];

  if (reachable.length === 0) {
    throw new SpeedTestError(
      "NO_SERVER_REACHABLE",
      "Could not reach any test server",
      "Check your internet connection and try again.",
    );
  }

  reachable.sort((a, b) => a.latency - b.latency);
  const best = reachable[0]!;

  const meta = await fetchServerMeta(best.server);

  return {
    ...best.server,
    selectionLatencyMs: round(best.latency, 2),
    ...meta,
  };
}

async function fetchServerMeta(
  server: TestServer,
): Promise<{ colo?: string; country?: string; city?: string }> {
  try {
    const url = urlsFor(server).meta();
    const res = await fetchWithTimeout(url, {
      method: "GET",
      cache: "no-store",
      timeoutMs: 5000,
    });
    const text = await res.text();
    if (server.provider === "cloudflare") {
      const trace = parseCloudflareTrace(text);
      return { colo: trace.colo, country: trace.loc };
    }
    // Only ever lift these three specific, known-safe fields out of a
    // custom/self-hosted server's response. Spreading the whole payload
    // would let a server's /__meta response clobber SelectedServer's own
    // `host`/`provider` fields (which are used to build every subsequent
    // request URL for this test) with arbitrary values of the same name —
    // exactly the bug that broke self-hosted server support during
    // testing: engineRoutes.ts's /__meta legitimately returns its own
    // `host`/`provider` keys for a different purpose, which used to
    // silently overwrite the server's real URL.
    const json = JSON.parse(text) as {
      colo?: unknown;
      country?: unknown;
      city?: unknown;
    };
    return {
      colo: typeof json.colo === "string" ? json.colo : undefined,
      country: typeof json.country === "string" ? json.country : undefined,
      city: typeof json.city === "string" ? json.city : undefined,
    };
  } catch {
    return {};
  }
}
