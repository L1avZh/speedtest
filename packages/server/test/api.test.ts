import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startServer, type RunningServer } from "../src/index.js";

describe("local API server", () => {
  let dir: string;
  let server: RunningServer;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "speedtest-api-"));
    server = await startServer({ dataDir: dir, enableEngineRoutes: true });
  });

  afterEach(async () => {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("binds to loopback by default", () => {
    expect(server.host).toBe("127.0.0.1");
  });

  it("serves health and meta", async () => {
    const health = await fetch(`${server.url}/api/health`).then((r) => r.json());
    expect(health.status).toBe("ok");
    const meta = await fetch(`${server.url}/api/meta`).then((r) => r.json());
    expect(meta.dataDir).toBe(dir);
    expect(meta.privacy.telemetry).toBe(false);
  });

  it("round-trips settings through PUT and GET", async () => {
    await fetch(`${server.url}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testing: { downloadConnections: 6 } }),
    });
    const settings = await fetch(`${server.url}/api/settings`).then((r) => r.json());
    expect(settings.testing.downloadConnections).toBe(6);
  });

  it("rejects a history POST with an invalid payload", async () => {
    const res = await fetch(`${server.url}/api/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ not: "a result" }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts a well-formed history entry and lists it back", async () => {
    const result = { id: "abc-123", timestamp: new Date().toISOString(), download: { mbps: 100 } };
    const postRes = await fetch(`${server.url}/api/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    expect(postRes.status).toBe(200);
    const list = await fetch(`${server.url}/api/history`).then((r) => r.json());
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("abc-123");
  });

  it("deletes a history entry by id", async () => {
    const result = { id: "to-delete", timestamp: new Date().toISOString() };
    await fetch(`${server.url}/api/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    await fetch(`${server.url}/api/history/to-delete`, { method: "DELETE" });
    const list = await fetch(`${server.url}/api/history`).then((r) => r.json());
    expect(list).toHaveLength(0);
  });

  it("allows CORS from another localhost origin but not a remote origin", async () => {
    const local = await fetch(`${server.url}/api/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(local.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");

    const remote = await fetch(`${server.url}/api/health`, {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(remote.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("caps download size on the self-hosted engine route", async () => {
    const res = await fetch(`${server.url}/__down?bytes=999999999999`);
    expect(res.status).toBe(200);
    // Hard-capped at 200MB regardless of what was requested — checked via
    // the declared Content-Length rather than downloading the full 200MB.
    expect(Number(res.headers.get("content-length"))).toBe(200_000_000);
    await res.body?.cancel();
  });

  it("rejects an invalid bytes parameter on the download route", async () => {
    const res = await fetch(`${server.url}/__down?bytes=not-a-number`);
    expect(res.status).toBe(400);
  });

  it("reports bytes received on the upload route", async () => {
    const res = await fetch(`${server.url}/__up`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(1000),
    });
    const json = await res.json();
    expect(json.bytesReceived).toBe(1000);
  });
});
