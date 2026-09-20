import { describe, expect, it } from "vitest";
import { formatMbps, formatMs, formatPercent, formatBytes, formatDuration } from "../src/format.js";

describe("format", () => {
  it("formats Mbps with Gbps switchover", () => {
    expect(formatMbps(487.3)).toBe("487.3 Mbps");
    expect(formatMbps(1500)).toBe("1.50 Gbps");
    expect(formatMbps(5.234)).toBe("5.23 Mbps");
  });

  it("formats ms and percent", () => {
    expect(formatMs(8.44)).toBe("8.4 ms");
    expect(formatPercent(0.05)).toBe("0.05%");
    expect(formatPercent(12.3)).toBe("12.3%");
  });

  it("formats bytes with unit scaling", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
  });

  it("formats durations", () => {
    expect(formatDuration(18400)).toBe("18.4s");
    expect(formatDuration(90_000)).toBe("1m 30s");
  });
});
