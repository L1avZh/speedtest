import { afterEach, describe, expect, it, vi } from "vitest";
import { selectServer } from "../src/serverSelection.js";
import type { TestServer } from "../src/types.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("selectServer", () => {
  it("selects a forced custom server and does not let /__meta's response clobber its host/provider", async () => {
    const customServer: TestServer = {
      id: "local-selfhost",
      name: "Local Self-Host",
      location: "localhost",
      host: "http://127.0.0.1:7338",
      provider: "custom",
    };

    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const href = url.toString();
      if (href.includes("/__meta")) {
        // A real self-hosted server's /__meta legitimately returns keys
        // named `host` and `provider` for its OWN unrelated purpose —
        // this must never overwrite the SelectedServer's real host/provider.
        return new Response(
          JSON.stringify({ engineProvider: "self-hosted", hostname: "some-machine", host: "some-machine", provider: "self-hosted" }),
          { status: 200 },
        );
      }
      // latency probe (GET .../__down?bytes=0)
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const selected = await selectServer({
      serverId: "local-selfhost",
      customServers: [customServer],
      timeoutMs: 2000,
    });

    expect(selected.host).toBe("http://127.0.0.1:7338");
    expect(selected.provider).toBe("custom");
  });

  it("throws SERVER_NOT_FOUND for an unknown forced server id", async () => {
    await expect(
      selectServer({ serverId: "does-not-exist", timeoutMs: 1000 }),
    ).rejects.toMatchObject({ code: "SERVER_NOT_FOUND" });
  });
});
