import { describe, expect, it } from "vitest";
import {
  computeQuality,
  computeStability,
  buildRecommendations,
  DEFAULT_THRESHOLDS,
} from "../src/quality.js";
import type { LatencyResult, ThroughputResult } from "../src/types.js";

function throughput(mbps: number, samples: number[] = []): ThroughputResult {
  return {
    mbps,
    avgMbps: mbps,
    peakMbps: mbps,
    bytesTransferred: 1,
    durationMs: 1000,
    connections: 4,
    samples: samples.map((s, i) => ({ tMs: i * 100, instantMbps: s, avgMbps: mbps, bytesTotal: 0 })),
  };
}

function latency(avgMs: number, jitterMs = 2, lossPercent = 0): LatencyResult {
  return {
    minMs: avgMs - 1,
    avgMs,
    maxMs: avgMs + 1,
    medianMs: avgMs,
    jitterMs,
    samples: [avgMs],
    packetsSent: 10,
    packetsLost: 0,
    lossPercent,
    method: "https-round-trip",
  };
}

describe("quality thresholds", () => {
  it("rates an excellent connection as excellent overall", () => {
    const download = throughput(300, [280, 300, 320, 300]);
    const upload = throughput(60);
    const lat = latency(10, 2, 0);
    const stability = computeStability(download);
    const quality = computeQuality(download, upload, lat, stability);
    expect(quality.download).toBe("excellent");
    expect(quality.upload).toBe("excellent");
    expect(quality.latency).toBe("excellent");
    expect(quality.overall).toBe("excellent");
  });

  it("rates a poor connection as poor overall", () => {
    const download = throughput(2);
    const upload = throughput(0.5);
    const lat = latency(300, 100, 10);
    const stability = computeStability(download);
    const quality = computeQuality(download, upload, lat, stability);
    expect(quality.download).toBe("poor");
    expect(quality.upload).toBe("poor");
    expect(quality.overall).toBe("poor");
  });

  it("respects custom thresholds", () => {
    const download = throughput(50);
    const upload = throughput(50);
    const lat = latency(10);
    const stability = computeStability(download);
    const strict = {
      ...DEFAULT_THRESHOLDS,
      download: { excellent: 1000, veryGood: 500, good: 200, fair: 100 },
    };
    const quality = computeQuality(download, upload, lat, stability, strict);
    expect(quality.download).toBe("poor");
  });

  it("flags high variation as unstable", () => {
    const download = throughput(100, [10, 200, 5, 190, 8]);
    const stability = computeStability(download);
    expect(stability.variationCoefficient).toBeGreaterThan(0.3);
    expect(["fair", "poor", "good"]).toContain(stability.rating);
  });

  it("builds honest, threshold-based recommendations", () => {
    const download = throughput(100);
    const upload = throughput(20);
    const lat = latency(15, 3, 0);
    const recs = buildRecommendations(download, upload, lat);
    const gaming = recs.find((r) => r.id === "gaming");
    expect(gaming?.suitable).toBe(true);
    const gamingBad = buildRecommendations(download, upload, latency(200, 80, 5)).find(
      (r) => r.id === "gaming",
    );
    expect(gamingBad?.suitable).toBe(false);
  });
});
