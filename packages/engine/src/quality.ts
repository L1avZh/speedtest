import type {
  LatencyResult,
  QualityBreakdown,
  QualityRating,
  StabilityResult,
  ThroughputResult,
  UseCaseRecommendation,
} from "./types.js";
import { coefficientOfVariation, round } from "./stats.js";

export interface Band {
  excellent: number;
  veryGood: number;
  good: number;
  fair: number;
}

export interface QualityThresholds {
  /** Mbps, higher is better. */
  download: Band;
  /** Mbps, higher is better. */
  upload: Band;
  /** ms, lower is better. */
  latency: Band;
  /** ms, lower is better. */
  jitter: Band;
  /** percent, lower is better. */
  packetLoss: Band;
  /** coefficient of variation (stddev/mean of throughput samples), lower is better. */
  stability: Band;
}

/**
 * Default quality thresholds. These are deliberately conservative,
 * widely-cited rules of thumb (ITU-T G.114 for one-way latency budgets,
 * streaming-provider published bitrate minimums) rather than invented
 * numbers, and are fully configurable — see Settings > Advanced.
 */
export const DEFAULT_THRESHOLDS: QualityThresholds = {
  download: { excellent: 200, veryGood: 100, good: 40, fair: 15 },
  upload: { excellent: 50, veryGood: 20, good: 10, fair: 3 },
  latency: { excellent: 20, veryGood: 40, good: 80, fair: 150 },
  jitter: { excellent: 5, veryGood: 15, good: 30, fair: 60 },
  packetLoss: { excellent: 0.1, veryGood: 1, good: 2.5, fair: 5 },
  stability: { excellent: 0.1, veryGood: 0.2, good: 0.35, fair: 0.5 },
};

const RATING_SCORE: Record<QualityRating, number> = {
  excellent: 5,
  "very-good": 4,
  good: 3,
  fair: 2,
  poor: 1,
};

function rateHigherIsBetter(value: number, band: Band): QualityRating {
  if (value >= band.excellent) return "excellent";
  if (value >= band.veryGood) return "very-good";
  if (value >= band.good) return "good";
  if (value >= band.fair) return "fair";
  return "poor";
}

function rateLowerIsBetter(value: number, band: Band): QualityRating {
  if (value <= band.excellent) return "excellent";
  if (value <= band.veryGood) return "very-good";
  if (value <= band.good) return "good";
  if (value <= band.fair) return "fair";
  return "poor";
}

export function computeStability(
  download: ThroughputResult,
  thresholds: QualityThresholds = DEFAULT_THRESHOLDS,
): StabilityResult {
  const instantValues = download.samples.map((s) => s.instantMbps);
  // Fewer than 2 samples means we don't have enough data to judge
  // variation; default to a neutral rating instead of letting
  // coefficientOfVariation([]) === 0 look "excellent" on a test that
  // barely ran (e.g. a near-instant failure).
  if (instantValues.length < 2) {
    return { variationCoefficient: 0, drops: 0, spikes: 0, rating: "good" };
  }
  const cv = coefficientOfVariation(instantValues);
  const mean = download.avgMbps;
  let drops = 0;
  let spikes = 0;
  for (const s of instantValues) {
    if (mean > 0 && s < mean * 0.5) drops++;
    if (mean > 0 && s > mean * 1.5) spikes++;
  }
  return {
    variationCoefficient: round(cv, 3),
    drops,
    spikes,
    rating: rateLowerIsBetter(cv, thresholds.stability),
  };
}

export function computeQuality(
  download: ThroughputResult,
  upload: ThroughputResult,
  latency: LatencyResult,
  stability: StabilityResult,
  thresholds: QualityThresholds = DEFAULT_THRESHOLDS,
): QualityBreakdown {
  const downloadRating = rateHigherIsBetter(download.mbps, thresholds.download);
  const uploadRating = rateHigherIsBetter(upload.mbps, thresholds.upload);
  const latencyRating = rateLowerIsBetter(latency.avgMs, thresholds.latency);
  const packetLossRating = rateLowerIsBetter(
    latency.lossPercent,
    thresholds.packetLoss,
  );

  const weighted =
    RATING_SCORE[downloadRating] * 0.3 +
    RATING_SCORE[uploadRating] * 0.2 +
    RATING_SCORE[latencyRating] * 0.2 +
    RATING_SCORE[stability.rating] * 0.15 +
    RATING_SCORE[packetLossRating] * 0.15;

  const overall = scoreToRating(weighted);

  return {
    download: downloadRating,
    upload: uploadRating,
    latency: latencyRating,
    stability: stability.rating,
    packetLoss: packetLossRating,
    overall,
  };
}

function scoreToRating(score: number): QualityRating {
  if (score >= 4.5) return "excellent";
  if (score >= 3.5) return "very-good";
  if (score >= 2.5) return "good";
  if (score >= 1.5) return "fair";
  return "poor";
}

interface UseCaseRule {
  id: string;
  label: string;
  check: (m: {
    download: number;
    upload: number;
    latency: number;
    jitter: number;
    packetLoss: number;
  }) => boolean;
  requirement: string;
}

const USE_CASES: UseCaseRule[] = [
  {
    id: "streaming-4k",
    label: "4K streaming",
    requirement: "≥ 25 Mbps download, ≤ 2% packet loss",
    check: (m) => m.download >= 25 && m.packetLoss <= 2,
  },
  {
    id: "streaming-hd",
    label: "HD streaming",
    requirement: "≥ 8 Mbps download",
    check: (m) => m.download >= 8,
  },
  {
    id: "gaming",
    label: "Online gaming",
    requirement: "≤ 50 ms latency, ≤ 20 ms jitter, ≤ 1% packet loss",
    check: (m) => m.latency <= 50 && m.jitter <= 20 && m.packetLoss <= 1,
  },
  {
    id: "video-conferencing",
    label: "Video conferencing",
    requirement: "≥ 3 Mbps up/down, ≤ 100 ms latency, ≤ 30 ms jitter",
    check: (m) =>
      m.download >= 3 && m.upload >= 3 && m.latency <= 100 && m.jitter <= 30,
  },
  {
    id: "large-downloads",
    label: "Large downloads",
    requirement: "≥ 50 Mbps download",
    check: (m) => m.download >= 50,
  },
  {
    id: "cloud-apps",
    label: "Cloud applications & remote desktop",
    requirement: "≥ 10 Mbps download, ≥ 5 Mbps upload, ≤ 60 ms latency",
    check: (m) => m.download >= 10 && m.upload >= 5 && m.latency <= 60,
  },
];

export function buildRecommendations(
  download: ThroughputResult,
  upload: ThroughputResult,
  latency: LatencyResult,
): UseCaseRecommendation[] {
  const metrics = {
    download: download.mbps,
    upload: upload.mbps,
    latency: latency.avgMs,
    jitter: latency.jitterMs,
    packetLoss: latency.lossPercent,
  };
  return USE_CASES.map((rule) => {
    const suitable = rule.check(metrics);
    return {
      id: rule.id,
      label: rule.label,
      suitable,
      reason: `Requires ${rule.requirement}.`,
    };
  });
}
