// Standalone demo-only server for recording README GIFs.
//
// This is deliberately NOT part of the shipped @speedtest/server package —
// it exists only so a local demo recording shows realistic home-internet
// numbers instead of raw loopback speed (multiple Gbps), which would look
// like fake/placeholder data even though it's technically real. Every byte
// here is still actually generated and actually transferred over a real
// HTTP connection; the only difference from packages/server/src/engineRoutes.ts
// is a deliberate bandwidth cap via paced writes, so the *pattern* of
// server → engine → UI is exactly what a real user's machine does.
import http from "node:http";
import crypto from "node:crypto";

// Per-connection targets, chosen so that N parallel connections (as
// configured in ~/.speedtest/settings.json for this recording) sum to a
// realistic aggregate — e.g. 4 download connections x 120Mbps ≈ 480Mbps.
const DOWNLOAD_MBPS = 120;
const UPLOAD_MBPS = 32;
const TICK_MS = 40;

function bytesPerTick(mbps) {
  return Math.round(((mbps * 1_000_000) / 8) * (TICK_MS / 1000));
}

function pacedDownloadStream(res, totalBytes, mbps) {
  let sent = 0;
  const perTick = bytesPerTick(mbps);
  const timer = setInterval(() => {
    if (sent >= totalBytes || res.destroyed) {
      clearInterval(timer);
      if (!res.writableEnded) res.end();
      return;
    }
    const size = Math.min(perTick, totalBytes - sent);
    sent += size;
    res.write(crypto.randomBytes(size));
  }, TICK_MS);
  res.on("close", () => clearInterval(timer));
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/__down") {
    const bytes = Math.min(Number(url.searchParams.get("bytes")) || 0, 200_000_000);
    res.writeHead(200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" });
    pacedDownloadStream(res, bytes, DOWNLOAD_MBPS);
    return;
  }

  if (url.pathname === "/__up") {
    let received = 0;
    const perTick = bytesPerTick(UPLOAD_MBPS);
    let allowance = perTick;
    const timer = setInterval(() => {
      allowance = Math.min(allowance + perTick, perTick * 3);
    }, TICK_MS);
    req.on("data", (chunk) => {
      received += chunk.length;
      // Simple pacing: pause the incoming stream when we're "ahead" of
      // the simulated upload rate, resume on the next allowance tick.
      if (allowance <= 0) {
        req.pause();
        const resume = setInterval(() => {
          if (allowance > 0) {
            clearInterval(resume);
            req.resume();
          }
        }, TICK_MS);
      }
      allowance -= chunk.length;
    });
    req.on("end", () => {
      clearInterval(timer);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ bytesReceived: received }));
    });
    return;
  }

  if (url.pathname === "/__meta") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ engineProvider: "self-hosted", city: "Demo LAN" }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const port = Number(process.argv[2]) || 7340;
server.listen(port, "127.0.0.1", () => {
  console.log(`Throttled demo server on http://127.0.0.1:${port} (down ~${DOWNLOAD_MBPS}Mbps / up ~${UPLOAD_MBPS}Mbps)`);
});
