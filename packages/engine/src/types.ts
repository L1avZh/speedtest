/**
 * Shared types for the SpeedTest engine, CLI, server, and web UI.
 * This is the single source of truth for the result schema (see docs/JSON-SCHEMA.md).
 */

export interface TestServer {
  id: string;
  name: string;
  location: string;
  /** Base URL of the measurement endpoint (must expose the provider's protocol below). */
  host: string;
  provider: "cloudflare" | "custom";
}

export interface SelectedServer extends TestServer {
  /** Measured round-trip time used to pick this server, in ms. */
  selectionLatencyMs: number;
  colo?: string;
  country?: string;
  city?: string;
}

export interface NetworkInfo {
  ip?: string;
  isp?: string;
  asn?: string;
  country?: string;
  city?: string;
  connectionType?: string;
  protocol: string;
}

export interface LatencyResult {
  minMs: number;
  avgMs: number;
  maxMs: number;
  medianMs: number;
  jitterMs: number;
  samples: number[];
  packetsSent: number;
  packetsLost: number;
  lossPercent: number;
  /** Honest label of the measurement method (see LIMITATIONS.md). */
  method: "https-round-trip";
}

export interface ThroughputSample {
  tMs: number;
  instantMbps: number;
  avgMbps: number;
  bytesTotal: number;
}

export interface ThroughputResult {
  mbps: number;
  avgMbps: number;
  peakMbps: number;
  bytesTransferred: number;
  durationMs: number;
  connections: number;
  samples: ThroughputSample[];
  /** Latency measured concurrently with the transfer ("loaded" latency). */
  loadedLatencyMs?: number;
}

export type QualityRating =
  "excellent" | "very-good" | "good" | "fair" | "poor";

export interface QualityBreakdown {
  download: QualityRating;
  upload: QualityRating;
  latency: QualityRating;
  stability: QualityRating;
  packetLoss: QualityRating;
  overall: QualityRating;
}

export interface UseCaseRecommendation {
  id: string;
  label: string;
  suitable: boolean;
  reason: string;
}

export interface StabilityResult {
  /** Coefficient of variation of throughput samples (0 = perfectly stable). */
  variationCoefficient: number;
  drops: number;
  spikes: number;
  rating: QualityRating;
}

export interface TestResult {
  id: string;
  timestamp: string;
  durationMs: number;
  server: SelectedServer;
  network: NetworkInfo;
  latency: LatencyResult;
  download: ThroughputResult;
  upload: ThroughputResult;
  stability: StabilityResult;
  quality: QualityBreakdown;
  recommendations: UseCaseRecommendation[];
  engineVersion: string;
  methodology: {
    downloadConnections: number;
    uploadConnections: number;
    downloadDurationTargetMs: number;
    uploadDurationTargetMs: number;
    latencySamples: number;
  };
}

export type TestPhase =
  | "idle"
  | "checking-connectivity"
  | "selecting-server"
  | "testing-latency"
  | "testing-download"
  | "testing-upload"
  | "analyzing"
  | "complete"
  | "error";

export interface ProgressEvent {
  phase: TestPhase;
  message: string;
  /** 0..1 progress within the current phase, when known. */
  progress?: number;
  live?: {
    currentMbps: number;
    avgMbps: number;
    peakMbps: number;
    elapsedMs: number;
    bytesTransferred: number;
  };
  server?: SelectedServer;
  latency?: LatencyResult;
  error?: { code: string; message: string; hint?: string };
}

export type ProgressListener = (event: ProgressEvent) => void;

export interface EngineOptions {
  /** Specific server id to force; otherwise automatic selection runs. */
  serverId?: string;
  /** Extra custom servers to consider, e.g. self-hosted instances. */
  customServers?: TestServer[];
  enableDownload: boolean;
  enableUpload: boolean;
  downloadDurationMs: number;
  uploadDurationMs: number;
  downloadConnections: number;
  uploadConnections: number;
  latencySamples: number;
  timeoutMs: number;
  /** Abort signal to cancel a running test. */
  signal?: AbortSignal;
}

export const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
  enableDownload: true,
  enableUpload: true,
  downloadDurationMs: 10000,
  uploadDurationMs: 8000,
  downloadConnections: 4,
  uploadConnections: 3,
  latencySamples: 12,
  timeoutMs: 15000,
};

export class SpeedTestError extends Error {
  code: string;
  hint?: string;
  constructor(code: string, message: string, hint?: string) {
    super(message);
    this.name = "SpeedTestError";
    this.code = code;
    this.hint = hint;
  }
}
