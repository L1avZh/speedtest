import { describe, expect, it } from "vitest";
import { compareResults } from "../src/compare.js";
import { resultToCsv, resultToJson, resultToText } from "../src/export.js";
import type { TestResult } from "../src/types.js";

function makeResult(overrides: Partial<TestResult> = {}): TestResult {
  const base: TestResult = {
    id: "abc123",
    timestamp: "2026-09-20T10:00:00.000Z",
    durationMs: 18400,
    server: {
      id: "cloudflare-global",
      name: "Cloudflare Global Network",
      location: "Nearest edge (anycast)",
      host: "https://speed.cloudflare.com",
      provider: "cloudflare",
      selectionLatencyMs: 8.4,
      colo: "TLV",
    },
    network: { protocol: "HTTPS", ip: "1.2.3.4", isp: "Example ISP" },
    latency: {
      minMs: 7,
      avgMs: 8.4,
      maxMs: 10,
      medianMs: 8.3,
      jitterMs: 1.7,
      samples: [7, 8, 9],
      packetsSent: 12,
      packetsLost: 0,
      lossPercent: 0,
      method: "https-round-trip",
    },
    download: {
      mbps: 487.3,
      avgMbps: 487.3,
      peakMbps: 503,
      bytesTransferred: 600_000_000,
      durationMs: 10000,
      connections: 4,
      samples: [],
    },
    upload: {
      mbps: 91.4,
      avgMbps: 91.4,
      peakMbps: 95,
      bytesTransferred: 90_000_000,
      durationMs: 8000,
      connections: 3,
      samples: [],
    },
    stability: { variationCoefficient: 0.05, drops: 0, spikes: 0, rating: "excellent" },
    quality: {
      download: "excellent",
      upload: "excellent",
      latency: "excellent",
      stability: "excellent",
      packetLoss: "excellent",
      overall: "excellent",
    },
    recommendations: [],
    engineVersion: "1.0.0",
    methodology: {
      downloadConnections: 4,
      uploadConnections: 3,
      downloadDurationTargetMs: 10000,
      uploadDurationTargetMs: 8000,
      latencySamples: 12,
    },
  };
  return { ...base, ...overrides };
}

describe("compareResults", () => {
  it("computes neutral factual deltas", () => {
    const before = makeResult({ download: { ...makeResult().download, mbps: 400 } });
    const after = makeResult({ download: { ...makeResult().download, mbps: 500 } });
    const comparison = compareResults(before, after);
    const download = comparison.metrics.find((m) => m.label === "Download")!;
    expect(download.before).toBe(400);
    expect(download.after).toBe(500);
    expect(download.deltaPercent).toBe(25);
    expect(download.improved).toBe(true);
  });

  it("treats lower latency as improvement", () => {
    const before = makeResult({ latency: { ...makeResult().latency, avgMs: 20 } });
    const after = makeResult({ latency: { ...makeResult().latency, avgMs: 10 } });
    const comparison = compareResults(before, after);
    const latency = comparison.metrics.find((m) => m.label === "Latency")!;
    expect(latency.improved).toBe(true);
    expect(latency.deltaPercent).toBe(-50);
  });
});

describe("export formats", () => {
  const result = makeResult();

  it("produces valid JSON round-trippable to the same values", () => {
    const json = resultToJson(result);
    const parsed = JSON.parse(json);
    expect(parsed.download.mbps).toBe(487.3);
    expect(parsed.id).toBe("abc123");
  });

  it("produces a CSV header + single data row", () => {
    const csv = resultToCsv(result);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("download_mbps");
    expect(lines[1]).toContain("487.3");
  });

  it("produces a readable plain-text summary", () => {
    const text = resultToText(result);
    expect(text).toContain("487.3 Mbps");
    expect(text).toContain("91.4 Mbps");
  });
});
