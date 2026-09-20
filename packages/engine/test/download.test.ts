import { afterEach, describe, expect, it, vi } from "vitest";
import { measureDownload } from "../src/download.js";
import { SpeedTestError } from "../src/types.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function streamOf(chunks: Uint8Array[], delayMs = 5): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      await new Promise((r) => setTimeout(r, delayMs));
      controller.enqueue(chunks[i]);
      i++;
    },
  });
}

describe("measureDownload", () => {
  it("counts every byte actually read from the stream", async () => {
    const chunk = new Uint8Array(1000).fill(1);
    globalThis.fetch = vi.fn(async () => {
      const body = streamOf([chunk, chunk, chunk], 5);
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await measureDownload({
      urlFor: (bytes) => `https://example.test/__down?bytes=${bytes}`,
      durationMs: 500,
      connections: 1,
      timeoutMs: 2000,
    });

    // At least the first request's chunks should have been counted before
    // the 500ms duration elapsed (3 chunks * 5ms each = 15ms, well within budget).
    expect(result.bytesTransferred).toBeGreaterThanOrEqual(3000);
    expect(result.mbps).toBeGreaterThan(0);
    expect(result.connections).toBe(1);
  });

  it("re-issues requests to keep multiple connections busy for the full duration", async () => {
    let requestCount = 0;
    globalThis.fetch = vi.fn(async () => {
      requestCount++;
      const chunk = new Uint8Array(500).fill(1);
      return new Response(streamOf([chunk], 10), { status: 200 });
    }) as unknown as typeof fetch;

    await measureDownload({
      urlFor: (bytes) => `https://example.test/__down?bytes=${bytes}`,
      durationMs: 120,
      connections: 2,
      timeoutMs: 2000,
    });

    // Each ~10ms request should be re-issued multiple times across a 120ms window.
    expect(requestCount).toBeGreaterThan(2);
  });

  it("surfaces a rate-limit-specific error on HTTP 429, not a generic network error", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 429 })) as unknown as typeof fetch;

    await expect(
      measureDownload({
        urlFor: (bytes) => `https://example.test/__down?bytes=${bytes}`,
        durationMs: 100,
        connections: 1,
        timeoutMs: 500,
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("throws a SpeedTestError when the server never responds", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch;

    await expect(
      measureDownload({
        urlFor: (bytes) => `https://example.test/__down?bytes=${bytes}`,
        durationMs: 100,
        connections: 1,
        timeoutMs: 500,
      }),
    ).rejects.toBeInstanceOf(SpeedTestError);
  });
});
