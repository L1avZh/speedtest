import type {
  EngineOptions,
  ProgressListener,
  TestResult,
  ThroughputResult,
} from "./types.js";
import { DEFAULT_ENGINE_OPTIONS, SpeedTestError } from "./types.js";
import { selectServer } from "./serverSelection.js";
import { urlsFor } from "./servers.js";
import { measureLatency } from "./latency.js";
import { measureDownload } from "./download.js";
import { measureUpload } from "./upload.js";
import {
  computeQuality,
  computeStability,
  buildRecommendations,
} from "./quality.js";
import { lookupNetworkInfo } from "./network.js";
import { round } from "./stats.js";

export const ENGINE_VERSION = "1.0.0";

function emptyThroughput(): ThroughputResult {
  return {
    mbps: 0,
    avgMbps: 0,
    peakMbps: 0,
    bytesTransferred: 0,
    durationMs: 0,
    connections: 0,
    samples: [],
  };
}

export interface RunTestOptions extends Partial<EngineOptions> {
  networkInfoLookup?: boolean;
  onProgress?: ProgressListener;
}

/**
 * Runs a complete, real speed test: server selection -> latency/jitter ->
 * download -> upload -> analysis. This is the single implementation used
 * by both the CLI and the Web UI (imported directly in the browser and in
 * Node). Every field on the returned TestResult is derived from an actual
 * network measurement performed during this call.
 */
export async function runSpeedTest(
  userOptions: RunTestOptions = {},
): Promise<TestResult> {
  const opts: EngineOptions = { ...DEFAULT_ENGINE_OPTIONS, ...userOptions };
  const emit = userOptions.onProgress ?? (() => {});
  const start = performance.now();
  const startedAt = new Date();

  emit({ phase: "checking-connectivity", message: "Checking connectivity…" });

  emit({ phase: "selecting-server", message: "Finding the best server…" });
  const server = await selectServer({
    serverId: opts.serverId,
    customServers: opts.customServers,
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
  });
  emit({
    phase: "selecting-server",
    message: `Selected ${server.name}`,
    server,
  });

  const network = await lookupNetworkInfo(
    userOptions.networkInfoLookup ?? true,
  );

  emit({
    phase: "testing-latency",
    message: "Measuring latency…",
    progress: 0,
  });
  const urls = urlsFor(server);
  const latency = await measureLatency({
    url: urls.latency(),
    samples: opts.latencySamples,
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
    onSample: (i, ms) => {
      emit({
        phase: "testing-latency",
        message: ms !== null ? `Ping ${ms.toFixed(0)} ms` : "Probe lost",
        progress: (i + 1) / opts.latencySamples,
      });
    },
  });
  emit({
    phase: "testing-latency",
    message: "Latency measured",
    progress: 1,
    latency,
  });

  let download = emptyThroughput();
  if (opts.enableDownload) {
    emit({
      phase: "testing-download",
      message: "Testing download speed…",
      progress: 0,
    });
    download = await measureDownload({
      urlFor: urls.download,
      durationMs: opts.downloadDurationMs,
      connections: opts.downloadConnections,
      timeoutMs: opts.timeoutMs,
      signal: opts.signal,
      onSample: (sample) => {
        emit({
          phase: "testing-download",
          message: `${sample.instantMbps.toFixed(0)} Mbps`,
          progress: Math.min(1, sample.tMs / opts.downloadDurationMs),
          live: {
            currentMbps: sample.instantMbps,
            avgMbps: sample.avgMbps,
            peakMbps: Math.max(sample.instantMbps, sample.avgMbps),
            elapsedMs: sample.tMs,
            bytesTransferred: sample.bytesTotal,
          },
        });
      },
    });
  }

  let upload = emptyThroughput();
  if (opts.enableUpload) {
    emit({
      phase: "testing-upload",
      message: "Testing upload speed…",
      progress: 0,
    });
    upload = await measureUpload({
      urlFor: urls.upload,
      durationMs: opts.uploadDurationMs,
      connections: opts.uploadConnections,
      timeoutMs: opts.timeoutMs,
      signal: opts.signal,
      onSample: (sample) => {
        emit({
          phase: "testing-upload",
          message: `${sample.instantMbps.toFixed(0)} Mbps`,
          progress: Math.min(1, sample.tMs / opts.uploadDurationMs),
          live: {
            currentMbps: sample.instantMbps,
            avgMbps: sample.avgMbps,
            peakMbps: Math.max(sample.instantMbps, sample.avgMbps),
            elapsedMs: sample.tMs,
            bytesTransferred: sample.bytesTotal,
          },
        });
      },
    });
  }

  emit({ phase: "analyzing", message: "Analyzing connection quality…" });
  const stability = computeStability(download);
  const quality = computeQuality(download, upload, latency, stability);
  const recommendations = buildRecommendations(download, upload, latency);

  const durationMs = round(performance.now() - start, 0);

  const result: TestResult = {
    id: crypto.randomUUID(),
    timestamp: startedAt.toISOString(),
    durationMs,
    server,
    network,
    latency,
    download,
    upload,
    stability,
    quality,
    recommendations,
    engineVersion: ENGINE_VERSION,
    methodology: {
      downloadConnections: opts.downloadConnections,
      uploadConnections: opts.uploadConnections,
      downloadDurationTargetMs: opts.downloadDurationMs,
      uploadDurationTargetMs: opts.uploadDurationMs,
      latencySamples: opts.latencySamples,
    },
  };

  emit({ phase: "complete", message: "Test complete" });
  return result;
}

export { SpeedTestError };
