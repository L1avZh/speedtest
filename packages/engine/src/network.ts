import type { NetworkInfo } from "./types.js";
import { fetchWithTimeout } from "./http.js";

const IP_INFO_URL = "https://ipwho.is/";

interface IpWhoIsResponse {
  ip: string;
  success: boolean;
  country?: string;
  city?: string;
  connection?: { asn?: number; org?: string; isp?: string };
}

/**
 * Best-effort IP/ISP lookup via ipwho.is, a free third-party geolocation
 * API reached directly from the browser/CLI (never proxied through our
 * own server, and never combined with test results server-side). This is
 * the ONLY network information source that isn't the test server itself,
 * and it is entirely optional — see Settings > Privacy > "Look up ISP/IP
 * details" (`networkInfoLookup`). When disabled, `network.isp`/`ip` are
 * simply omitted from the result; nothing about the test is degraded.
 */
export async function lookupNetworkInfo(
  enabled: boolean,
  timeoutMs = 4000,
): Promise<NetworkInfo> {
  const protocol = "HTTPS";
  if (!enabled) return { protocol };

  try {
    const res = await fetchWithTimeout(IP_INFO_URL, {
      method: "GET",
      cache: "no-store",
      timeoutMs,
    });
    const data = (await res.json()) as IpWhoIsResponse;
    if (!data.success) return { protocol };
    return {
      ip: data.ip,
      isp: data.connection?.isp ?? data.connection?.org,
      asn: data.connection?.asn ? `AS${data.connection.asn}` : undefined,
      country: data.country,
      city: data.city,
      connectionType: detectConnectionType(),
      protocol,
    };
  } catch {
    return { protocol };
  }
}

function detectConnectionType(): string | undefined {
  const nav = (
    globalThis as {
      navigator?: { connection?: { effectiveType?: string; type?: string } };
    }
  ).navigator;
  const conn = nav?.connection;
  if (!conn) return undefined;
  return conn.type ?? conn.effectiveType;
}
