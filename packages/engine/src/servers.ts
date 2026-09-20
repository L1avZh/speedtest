import type { TestServer } from "./types.js";

/**
 * Built-in server registry.
 *
 * The default provider is Cloudflare's public speed-test edge
 * (speed.cloudflare.com), the same infrastructure that powers
 * https://speed.cloudflare.com. It is a real, publicly documented,
 * CORS-enabled measurement endpoint (GET /__down, POST /__up,
 * GET /cdn-cgi/trace) reachable from both Node and the browser, and is
 * anycast so the "nearest" edge is selected automatically by the network.
 *
 * Advanced/self-hosted use: point at any server running
 * `@speedtest/server --engine-only`, which speaks the same minimal
 * protocol (see packages/server/src/engineRoutes.ts). This is how
 * "manual server selection" and LAN/VPS testing are implemented for real,
 * without fabricating a fake multi-region CDN we don't operate.
 */
export const BUILTIN_SERVERS: TestServer[] = [
  {
    id: "cloudflare-global",
    name: "Cloudflare Global Network",
    location: "Nearest edge (anycast)",
    host: "https://speed.cloudflare.com",
    provider: "cloudflare",
  },
];

export function findServer(
  id: string,
  extra: TestServer[] = [],
): TestServer | undefined {
  return [...BUILTIN_SERVERS, ...extra].find((s) => s.id === id);
}

export interface ProviderUrls {
  download(bytes: number): string;
  upload(): string;
  latency(): string;
  meta(): string;
}

export function urlsFor(server: TestServer): ProviderUrls {
  const base = server.host.replace(/\/$/, "");
  if (server.provider === "cloudflare") {
    return {
      download: (bytes: number) => `${base}/__down?bytes=${bytes}`,
      upload: () => `${base}/__up`,
      latency: () => `${base}/__down?bytes=0`,
      meta: () => `${base}/cdn-cgi/trace`,
    };
  }
  // Custom / self-hosted @speedtest/server engine protocol.
  return {
    download: (bytes: number) => `${base}/__down?bytes=${bytes}`,
    upload: () => `${base}/__up`,
    latency: () => `${base}/__down?bytes=0`,
    meta: () => `${base}/__meta`,
  };
}

export function parseCloudflareTrace(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}
