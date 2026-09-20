import type { TestResult } from "./types.js";

export function resultToJson(result: TestResult): string {
  return JSON.stringify(result, null, 2);
}

const CSV_COLUMNS: [string, (r: TestResult) => string | number][] = [
  ["timestamp", (r) => r.timestamp],
  ["server_name", (r) => r.server.name],
  ["server_location", (r) => r.server.location],
  ["download_mbps", (r) => r.download.mbps],
  ["upload_mbps", (r) => r.upload.mbps],
  ["ping_ms", (r) => r.latency.avgMs],
  ["jitter_ms", (r) => r.latency.jitterMs],
  ["packet_loss_percent", (r) => r.latency.lossPercent],
  ["quality_overall", (r) => r.quality.overall],
  ["duration_ms", (r) => r.durationMs],
  ["ip", (r) => r.network.ip ?? ""],
  ["isp", (r) => r.network.isp ?? ""],
];

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function resultToCsv(result: TestResult): string {
  const header = CSV_COLUMNS.map(([name]) => name).join(",");
  const row = CSV_COLUMNS.map(([, get]) => csvEscape(get(result))).join(",");
  return `${header}\n${row}`;
}

export function resultsToCsv(results: TestResult[]): string {
  const header = CSV_COLUMNS.map(([name]) => name).join(",");
  const rows = results.map((r) =>
    CSV_COLUMNS.map(([, get]) => csvEscape(get(r))).join(","),
  );
  return [header, ...rows].join("\n");
}

/** Compact, copy-paste-friendly plain-text summary (for "Copy Results"). */
export function resultToText(result: TestResult): string {
  return [
    `Speed Test Result — ${new Date(result.timestamp).toLocaleString()}`,
    `Server: ${result.server.name} (${result.server.location})`,
    `Download: ${result.download.mbps} Mbps`,
    `Upload: ${result.upload.mbps} Mbps`,
    `Ping: ${result.latency.avgMs} ms  Jitter: ${result.latency.jitterMs} ms  Loss: ${result.latency.lossPercent}%`,
    `Quality: ${result.quality.overall}`,
  ].join("\n");
}
