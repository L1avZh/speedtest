export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number);
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

/** RFC 3550-style jitter: mean absolute difference between consecutive samples. */
export function jitter(values: number[]): number {
  if (values.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < values.length; i++) {
    total += Math.abs((values[i] as number) - (values[i - 1] as number));
  }
  return total / (values.length - 1);
}

export function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  return stddev(values) / m;
}

export function bytesToMbps(bytes: number, ms: number): number {
  if (ms <= 0) return 0;
  const bits = bytes * 8;
  const seconds = ms / 1000;
  return bits / seconds / 1_000_000;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
