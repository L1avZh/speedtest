import { describe, expect, it } from "vitest";
import {
  mean,
  median,
  stddev,
  jitter,
  coefficientOfVariation,
  bytesToMbps,
  clamp,
  round,
} from "../src/stats.js";

describe("stats", () => {
  it("computes mean", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([])).toBe(0);
  });

  it("computes median for odd and even length arrays", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it("computes population standard deviation", () => {
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 4);
    expect(stddev([5])).toBe(0);
  });

  it("computes jitter as mean absolute successive difference", () => {
    expect(jitter([10, 12, 8, 14])).toBeCloseTo((2 + 4 + 6) / 3, 5);
    expect(jitter([10])).toBe(0);
  });

  it("computes coefficient of variation", () => {
    expect(coefficientOfVariation([10, 10, 10])).toBe(0);
    expect(coefficientOfVariation([])).toBe(0);
    expect(coefficientOfVariation([0, 0])).toBe(0);
  });

  it("converts bytes+ms to Mbps correctly", () => {
    // 12,500,000 bytes in 1000ms = 100,000,000 bits/s = 100 Mbps
    expect(bytesToMbps(12_500_000, 1000)).toBeCloseTo(100, 5);
    expect(bytesToMbps(1000, 0)).toBe(0);
  });

  it("clamps values into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it("rounds to n decimals", () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.005, 2)).toBeCloseTo(1.01, 1);
  });
});
