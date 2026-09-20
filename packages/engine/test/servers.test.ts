import { describe, expect, it } from "vitest";
import { BUILTIN_SERVERS, findServer, parseCloudflareTrace, urlsFor } from "../src/servers.js";

describe("server registry", () => {
  it("finds a built-in server by id", () => {
    expect(findServer("cloudflare-global")).toBeDefined();
    expect(findServer("nonexistent")).toBeUndefined();
  });

  it("finds a custom server passed in explicitly", () => {
    const custom = {
      id: "my-vps",
      name: "My VPS",
      location: "Home",
      host: "https://vps.example.com",
      provider: "custom" as const,
    };
    expect(findServer("my-vps", [custom])).toEqual(custom);
  });

  it("builds correct Cloudflare provider URLs", () => {
    const server = BUILTIN_SERVERS[0]!;
    const urls = urlsFor(server);
    expect(urls.download(1000)).toBe("https://speed.cloudflare.com/__down?bytes=1000");
    expect(urls.upload()).toBe("https://speed.cloudflare.com/__up");
    expect(urls.meta()).toBe("https://speed.cloudflare.com/cdn-cgi/trace");
  });

  it("builds correct custom provider URLs", () => {
    const urls = urlsFor({
      id: "x",
      name: "x",
      location: "x",
      host: "https://vps.example.com/",
      provider: "custom",
    });
    expect(urls.download(500)).toBe("https://vps.example.com/__down?bytes=500");
    expect(urls.meta()).toBe("https://vps.example.com/__meta");
  });

  it("parses Cloudflare trace responses", () => {
    const trace = parseCloudflareTrace("fl=123\nip=1.2.3.4\ncolo=TLV\nloc=IL\n");
    expect(trace.colo).toBe("TLV");
    expect(trace.loc).toBe("IL");
    expect(trace.ip).toBe("1.2.3.4");
  });
});
