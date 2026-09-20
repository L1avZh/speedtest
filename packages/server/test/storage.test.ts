import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { HistoryStore, SettingsStore } from "../src/storage.js";
import type { TestResult } from "@speedtest/engine";

function makeResult(id: string, mbps = 100): TestResult {
  return {
    id,
    timestamp: new Date().toISOString(),
    durationMs: 1000,
    server: {
      id: "cloudflare-global",
      name: "Cloudflare Global Network",
      location: "Nearest edge",
      host: "https://speed.cloudflare.com",
      provider: "cloudflare",
      selectionLatencyMs: 5,
    },
    network: { protocol: "HTTPS" },
    latency: {
      minMs: 5,
      avgMs: 6,
      maxMs: 7,
      medianMs: 6,
      jitterMs: 1,
      samples: [6],
      packetsSent: 5,
      packetsLost: 0,
      lossPercent: 0,
      method: "https-round-trip",
    },
    download: { mbps, avgMbps: mbps, peakMbps: mbps, bytesTransferred: 1, durationMs: 1000, connections: 4, samples: [] },
    upload: { mbps, avgMbps: mbps, peakMbps: mbps, bytesTransferred: 1, durationMs: 1000, connections: 3, samples: [] },
    stability: { variationCoefficient: 0, drops: 0, spikes: 0, rating: "good" },
    quality: { download: "good", upload: "good", latency: "good", stability: "good", packetLoss: "excellent", overall: "good" },
    recommendations: [],
    engineVersion: "1.0.0",
    methodology: { downloadConnections: 4, uploadConnections: 3, downloadDurationTargetMs: 10000, uploadDurationTargetMs: 8000, latencySamples: 12 },
  };
}

describe("HistoryStore", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "speedtest-history-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("starts empty", async () => {
    const store = new HistoryStore(dir);
    expect(await store.list()).toEqual([]);
  });

  it("adds results most-recent-first and persists to disk", async () => {
    const store = new HistoryStore(dir);
    await store.add(makeResult("a", 100));
    await store.add(makeResult("b", 200));
    const list = await store.list();
    expect(list.map((r) => r.id)).toEqual(["b", "a"]);

    // A fresh store instance pointed at the same dir sees the same data.
    const reopened = new HistoryStore(dir);
    expect((await reopened.list()).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("removes a single result by id", async () => {
    const store = new HistoryStore(dir);
    await store.add(makeResult("a"));
    await store.add(makeResult("b"));
    await store.remove("a");
    const list = await store.list();
    expect(list.map((r) => r.id)).toEqual(["b"]);
  });

  it("clears all results", async () => {
    const store = new HistoryStore(dir);
    await store.add(makeResult("a"));
    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it("recovers gracefully from a corrupt history file", async () => {
    const store = new HistoryStore(dir);
    await store.add(makeResult("a"));
    const fs = await import("node:fs/promises");
    await fs.writeFile(path.join(dir, "history.json"), "{ not valid json", "utf-8");
    const list = await store.list();
    expect(list).toEqual([]);
  });
});

describe("SettingsStore", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "speedtest-settings-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns defaults when no file exists", async () => {
    const store = new SettingsStore(dir);
    const settings = await store.get();
    expect(settings.testing.downloadConnections).toBe(4);
    expect(settings.privacy.localHistoryEnabled).toBe(true);
  });

  it("merges a partial update without discarding other fields", async () => {
    const store = new SettingsStore(dir);
    await store.update({ testing: { downloadConnections: 8 } });
    const settings = await store.get();
    expect(settings.testing.downloadConnections).toBe(8);
    // Untouched sibling fields survive the merge.
    expect(settings.testing.uploadConnections).toBe(3);
    expect(settings.privacy.localHistoryEnabled).toBe(true);
  });

  it("resets to defaults", async () => {
    const store = new SettingsStore(dir);
    await store.update({ testing: { downloadConnections: 8 } });
    const reset = await store.reset();
    expect(reset.testing.downloadConnections).toBe(4);
  });
});
