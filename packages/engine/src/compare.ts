import type { TestResult } from "./types.js";
import { round } from "./stats.js";

export interface MetricComparison {
  label: string;
  unit: string;
  before: number;
  after: number;
  deltaPercent: number;
  /** true when a larger "after" value is the desirable direction (e.g. download). */
  higherIsBetter: boolean;
  improved: boolean;
}

export interface ResultComparison {
  before: TestResult;
  after: TestResult;
  metrics: MetricComparison[];
}

function compareMetric(
  label: string,
  unit: string,
  before: number,
  after: number,
  higherIsBetter: boolean,
): MetricComparison {
  const deltaPercent =
    before === 0 ? 0 : round(((after - before) / before) * 100, 1);
  const improved = higherIsBetter ? after >= before : after <= before;
  return { label, unit, before, after, deltaPercent, higherIsBetter, improved };
}

/** Purely factual, neutral comparison between two past test results. */
export function compareResults(
  before: TestResult,
  after: TestResult,
): ResultComparison {
  return {
    before,
    after,
    metrics: [
      compareMetric(
        "Download",
        "Mbps",
        before.download.mbps,
        after.download.mbps,
        true,
      ),
      compareMetric(
        "Upload",
        "Mbps",
        before.upload.mbps,
        after.upload.mbps,
        true,
      ),
      compareMetric(
        "Latency",
        "ms",
        before.latency.avgMs,
        after.latency.avgMs,
        false,
      ),
      compareMetric(
        "Jitter",
        "ms",
        before.latency.jitterMs,
        after.latency.jitterMs,
        false,
      ),
      compareMetric(
        "Packet Loss",
        "%",
        before.latency.lossPercent,
        after.latency.lossPercent,
        false,
      ),
    ],
  };
}
