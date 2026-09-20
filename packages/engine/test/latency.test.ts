import { afterEach, describe, expect, it, vi } from "vitest";
import { measureLatency } from "../src/latency.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("measureLatency", () => {
  it("records round-trip samples and computes stats", async () => {
    let call = 0;
    globalThis.fetch = vi.fn(async () => {
      call++;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await measureLatency({
      url: "https://example.test/__down?bytes=0",
      samples: 5,
      timeoutMs: 1000,
    });

    expect(call).toBe(5);
    expect(result.packetsSent).toBe(5);
    expect(result.packetsLost).toBe(0);
    expect(result.lossPercent).toBe(0);
    expect(result.samples).toHaveLength(5);
    expect(result.avgMs).toBeGreaterThanOrEqual(0);
    expect(result.method).toBe("https-round-trip");
  });

  it("counts failed probes as lost and reflects loss percent", async () => {
    let call = 0;
    globalThis.fetch = vi.fn(async () => {
      call++;
      if (call % 2 === 0) throw new Error("simulated network failure");
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await measureLatency({
      url: "https://example.test/__down?bytes=0",
      samples: 4,
      timeoutMs: 1000,
    });

    expect(result.packetsSent).toBe(4);
    expect(result.packetsLost).toBe(2);
    expect(result.lossPercent).toBe(50);
  });

  it("returns a zeroed, fully-lost result when every probe fails", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const result = await measureLatency({
      url: "https://example.test/__down?bytes=0",
      samples: 3,
      timeoutMs: 1000,
    });

    expect(result.packetsLost).toBe(3);
    expect(result.lossPercent).toBe(100);
    expect(result.avgMs).toBe(0);
    expect(result.samples).toHaveLength(0);
  });
});
