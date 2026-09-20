import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import os from "node:os";

// Hard caps protect a self-hosted engine server from being used as a
// resource-exhaustion / bandwidth-amplification vector by an arbitrary
// caller: no single request can demand more than 200MB down or consume
// more than 200MB up, regardless of what the client asks for.
const MAX_REQUEST_BYTES = 200_000_000;
const RANDOM_CHUNK_SIZE = 256 * 1024;

// A pool of pre-generated random chunks avoids calling the CSPRNG on the
// hot path for every byte of every download — plenty random enough for
// throughput measurement (this is bandwidth filler, not cryptographic
// material) while keeping CPU usage low during the test.
const chunkPool: Buffer[] = Array.from({ length: 8 }, () =>
  randomBytes(RANDOM_CHUNK_SIZE),
);

function randomDownloadStream(totalBytes: number): Readable {
  let sent = 0;
  let poolIndex = 0;
  return new Readable({
    read() {
      if (sent >= totalBytes) {
        this.push(null);
        return;
      }
      const remaining = totalBytes - sent;
      const chunk = chunkPool[poolIndex % chunkPool.length]!;
      poolIndex++;
      const slice =
        remaining < chunk.length ? chunk.subarray(0, remaining) : chunk;
      sent += slice.length;
      this.push(slice);
    },
  });
}

/**
 * Minimal self-hosted measurement-server protocol, compatible in shape
 * with the built-in Cloudflare provider (GET /__down?bytes=N, POST /__up,
 * GET /__meta). Lets advanced users run their own server (LAN box, VPS)
 * and point the CLI/Web UI at it via Settings > Testing > Server
 * Selection > Manual, for genuine self-hosted / LAN-vs-WAN comparisons —
 * not a second fake implementation of the same feature.
 */
export function registerEngineRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { bytes?: string } }>(
    "/__down",
    async (req, reply) => {
      const requested = Number.parseInt(req.query.bytes ?? "0", 10);
      if (!Number.isFinite(requested) || requested < 0) {
        return reply
          .status(400)
          .send({ error: "Invalid 'bytes' query parameter" });
      }
      const bytes = Math.min(requested, MAX_REQUEST_BYTES);
      reply.header("Content-Type", "application/octet-stream");
      reply.header("Cache-Control", "no-store");
      reply.header("Content-Length", String(bytes));
      return reply.send(randomDownloadStream(bytes));
    },
  );

  app.post("/__up", async (req, reply) => {
    let received = 0;
    let overLimit = false;
    await new Promise<void>((resolve, reject) => {
      req.raw.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_REQUEST_BYTES && !overLimit) {
          overLimit = true;
          req.raw.destroy();
        }
      });
      req.raw.on("end", resolve);
      req.raw.on("error", reject);
      req.raw.on("close", () => resolve());
    });
    if (overLimit) {
      return reply
        .status(413)
        .send({ error: "Upload exceeds maximum test size" });
    }
    return reply.send({ bytesReceived: received });
  });

  // Field names deliberately avoid colliding with TestServer's own
  // `host`/`provider` fields — the engine only ever lifts `city` out of
  // this response, but a distinct, non-colliding shape is the safer
  // contract for this protocol regardless.
  app.get("/__meta", async () => ({
    engineProvider: "self-hosted",
    hostname: os.hostname(),
    city: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
  }));
}
