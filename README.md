# SpeedTest

A professional internet speed test — real measurements only, no fake data, no telemetry.
One shared network engine, two interfaces: a polished terminal UI and a local web app.

```
$ speedtest

╭──────────────────────────────────────────────╮
│                   SPEEDTEST                   │
╰──────────────────────────────────────────────╯

✓ Server: Cloudflare Global Network (Nearest edge (anycast))
✓ Latency 8.4 ms · Jitter 1.7 ms · Loss 0.0%

Download  ████████████████████████████░░░░  487.3 Mbps
Upload    ███████████████████░░░░░░░░░░░░░   91.4 Mbps

──────────────────────────────────────────────
Network Quality: Excellent
Test completed in 18.4s
```

## Features

- **Real measurements, always.** Download, upload, latency, jitter, and packet-loss approximation come from live network I/O — never randomized or hardcoded. See [Methodology](#test-methodology) for exactly how, and what's honestly *not* measurable without root/native code.
- **One engine, two interfaces.** `@speedtest/engine` is an isomorphic TypeScript package imported directly by both the CLI (Node) and the Web UI (in-browser) — no duplicated logic, no proxying test traffic through an extra hop.
- **Real-time graph.** A canvas-based live chart of actual instantaneous throughput samples during the test, not a fake loading animation.
- **Connection-quality analysis** against configurable thresholds, with honest, threshold-based "well suited for" recommendations (4K streaming, gaming, video calls, etc.) — never an unsupported claim.
- **Local history, comparison, export.** Every result is saved as plain JSON on your machine (`~/.speedtest`), never uploaded anywhere. Compare any two past runs, export JSON/CSV, copy a summary.
- **Privacy-first.** No analytics, no telemetry, no crash reporting. The only network calls are to the test server you choose and, optionally, a third-party IP/ISP lookup you can disable in Settings.
- **Secure by default.** The local API binds to `127.0.0.1` only, validates and caps every input that touches the filesystem or network, and never binds wider without an explicit opt-in.

## Installation

Requires Node.js 18.17+ (fetch with streaming request bodies).

```bash
git clone <this-repo>
cd speedtest
npm install
npm run build
```

This builds all four workspace packages (`engine`, `server`, `web`, `cli`) in dependency order. Run the CLI directly from the build output:

```bash
node packages/cli/dist/index.js
```

Or link it as a global `speedtest` command for local development:

```bash
npm link --workspace packages/cli
speedtest --help
```

See [Packaging](#packaging--release) for turning this into a single distributable binary.

## CLI usage

```bash
speedtest                       # Interactive terminal test (prompts CLI vs Web if run with no flags in a TTY)
speedtest --cli                 # Force terminal mode, skip the picker
speedtest --json                # Machine-readable JSON, no decorative output
speedtest --csv                 # Single CSV row, no decorative output
speedtest --server <id>         # Force a specific server
speedtest --no-download         # Skip the download phase
speedtest --no-upload           # Skip the upload phase
speedtest --timeout <seconds>   # Per-request timeout (default 15)
speedtest --verbose             # Extra diagnostic detail in the report
speedtest --no-save             # Don't record this result in local history
speedtest --web                 # Launch the Web UI instead
speedtest --web --port 8080     # Web UI on a specific port
speedtest --web --no-open       # Don't auto-open a browser tab
speedtest history                # List saved results
speedtest history --json|--csv   # Export history
speedtest history --clear        # Delete all saved history
```

`--json` and `--csv` skip every spinner/animation and print exactly one machine-readable payload, so `speedtest --json` is safe to use in scripts, cron jobs, and CI. The JSON schema is the `TestResult` type in [`packages/engine/src/types.ts`](packages/engine/src/types.ts) — every field is documented there and is considered part of the CLI's stable public interface.

## Web usage

```bash
speedtest --web
```

Starts a local API + static server (default: an automatically chosen free port, printed to the terminal) and opens it in your default browser. The page runs the *same* `@speedtest/engine` package directly in-browser against the real client network path — the local server's job is settings/history persistence and serving the app, not proxying your test traffic (proxying through an extra local hop would make the measurement less accurate, not more).

For local frontend development with hot reload:

```bash
npm run dev -w packages/web     # Vite dev server on :5173, proxies /api to :7337
node packages/cli/dist/index.js --web   # in another terminal, for the API
```

## Configuration

Settings live in `~/.speedtest/settings.json` (or `--data-dir`), shared by the CLI and Web UI, and are fully editable from **Settings** in the Web UI:

| Section | Controls |
|---|---|
| General | theme, units, default interface |
| Testing | download/upload duration & connection count, latency sample count, timeout, server selection mode |
| Privacy | local history on/off, ISP/IP lookup on/off |
| Advanced | debug logging, verbose mode, port, bind-all-interfaces, quality thresholds |

## Architecture

```
┌─────────────────────┐        ┌─────────────────────┐
│         CLI          │        │        Web UI         │
│  (Node, terminal UI)  │        │  (React, runs in      │
│                       │        │   browser)             │
└──────────┬────────────┘        └──────────┬────────────┘
           │  imports directly               │  imports directly
           ▼                                 ▼
        ┌───────────────────────────────────────┐
        │        @speedtest/engine (isomorphic)   │
        │  server selection · latency/jitter      │
        │  download/upload transfer · quality      │
        │  scoring · export/compare                │
        └───────────────────┬─────────────────────┘
                             │ real HTTPS requests
                             ▼
              Cloudflare's public speed-test edge
             (speed.cloudflare.com — CORS-enabled,
              same infra behind speed.cloudflare.com)

        ┌───────────────────────────────────────┐
        │      @speedtest/server (Fastify)         │
        │  127.0.0.1-only local API: settings,     │
        │  history (~/.speedtest/*.json), serves    │
        │  the built Web UI. Never touches your     │
        │  test's bytes.                            │
        └───────────────────────────────────────┘
```

**Why the engine runs client-side, not server-proxied.** The spec-standard architecture for a browser speed test is for the browser to measure its own real network path directly — proxying test traffic through your own local Node process would add a hop, cap throughput at your loopback/Node event-loop speed, and measure the wrong thing. The local API server's job is orchestration (settings, history, serving the app), not carrying test bytes. The CLI's Node process runs the same engine code directly against the internet for the same reason.

**Server selection.** The built-in provider is Cloudflare's public, CORS-enabled speed-test edge (`speed.cloudflare.com`) — the same anycast infrastructure behind `speed.cloudflare.com` itself, reachable identically from Node and the browser. `packages/server/src/engineRoutes.ts` implements the same minimal protocol (`GET /__down`, `POST /__up`, `GET /__meta`) so you can self-host a server (LAN box, VPS) with `speedtest --web --engine-server` and point another instance at it via Settings → Testing → Server Selection → Manual — genuine multi-server support without fabricating infrastructure this project doesn't operate.

## Test methodology

| Metric | Method |
|---|---|
| Latency | 12 (configurable) independent HTTPS round-trips to a zero-byte endpoint, spaced 40ms apart. Reported as min/avg/max/median. This is **not** a raw ICMP ping — neither Node nor a browser can send raw ICMP without OS-level privileges and a native addon, so, like every browser-based speed test, we measure real TCP/TLS request-response time instead. `latency.method` is explicitly `"https-round-trip"` in the result so this is never presented as something it isn't. |
| Jitter | Mean absolute difference between consecutive latency samples (RFC 3550-style). |
| Packet loss | Approximated as the percentage of latency probes that failed to complete within the timeout. This is an application-layer request-loss rate, not IP-layer packet loss — the same honest limitation as latency, for the same reason. |
| Download / Upload | 4 (down) / 3 (up) concurrent HTTPS connections streaming real bytes for a configurable duration (default 10s / 8s), continuously re-issuing requests to fill the window. Every byte counted comes from an actual `ReadableStream` read (download) or a chunk actually pulled onto the wire (upload) — nothing is derived from `Content-Length` alone or synthesized. |
| Stability | Coefficient of variation of the download's instantaneous-throughput samples. |
| Quality ratings | Each metric is bucketed against configurable thresholds (`packages/engine/src/quality.ts`) into excellent/very-good/good/fair/poor; the overall rating is a weighted average. Thresholds are documented inline with their justification (ITU-T latency guidance, published streaming bitrate minimums) and are editable in Settings → Advanced. |
| "Well suited for" | Each use case (4K streaming, gaming, video calls, …) has an explicit, stated numeric requirement checked against your actual measured numbers — never a vague or unsupported claim. |

## Privacy

- **No analytics, telemetry, or crash reporting**, anywhere in this codebase.
- Your test traffic goes to the test server you select — by default, Cloudflare's public speed-test edge — and nowhere else.
- ISP/IP details (Settings → Privacy → "Look up ISP / IP details") are optional and, when enabled, come from one direct browser request to `ipwho.is`, a third-party service. Disable it and your test still runs identically; only that one field is omitted.
- Results and settings are plain JSON files under `~/.speedtest/` on your machine. Nothing is uploaded, synced, or shared unless you explicitly export/share a result yourself.
- "Share Results" copies a plain-text summary to your clipboard (or uses your OS share sheet, if available) — there is no hosted backend and no result is ever sent to any server, by design; see `packages/web/src/components/ResultsScreen.tsx`.

## Security

- The local API server binds to `127.0.0.1` only by default; enabling network-wide access requires an explicit `--host`/setting change, never the default.
- CORS on the local API only allows other `localhost`/`127.0.0.1` origins — a malicious page on the public internet cannot call it.
- The self-hosted engine-server mode (`--engine-server`) hard-caps every request at 200MB and validates the `bytes` query parameter, preventing it from being used as a bandwidth-amplification or memory-exhaustion vector.
- History/settings files are read defensively: a corrupted file is backed up and replaced with safe defaults rather than crashing or silently losing data.
- `npm audit --omit=dev` reports **0 vulnerabilities** in production dependencies. A small number of moderate/high advisories remain in `vite`'s dev-only tooling chain (exploitable only if you run `vite dev` and simultaneously visit a malicious page) — never shipped in the built app; see `npm audit`.

## Development

```bash
npm install
npm run build          # build all packages, in dependency order
npm run dev:web         # Vite dev server with HMR for the Web UI
npm run typecheck        # tsc --noEmit across every package
npm run lint             # ESLint across every package
npm run format            # Prettier
```

## Testing

```bash
npm run test            # engine (37 tests) + server (18 tests), via vitest
```

Coverage includes: statistics helpers (mean/median/jitter/coefficient of variation), quality-threshold rating logic (including a real bug this test suite caught — see below), latency measurement with a mocked `fetch` (success, partial loss, total loss), download transfer with a real streaming `ReadableStream` (byte counting, connection re-issue, and HTTP-status classification including 429 rate-limiting), result comparison/export formatting, the server registry/URL builder, file-backed history & settings storage (including corrupt-file recovery), and the local API's HTTP surface end-to-end (settings round-trip, history CRUD, CORS allow/deny, the self-hosted engine route's size cap and input validation).

The Web UI and CLI were also verified manually end-to-end against the live internet during development (see commit history / development notes): real download/upload/latency numbers, the live graph, history, comparison mode, settings persistence, light/dark theme, and a 375px mobile layout were all exercised in a real browser.

## Building & Packaging

```bash
npm run build
```

produces:

- `packages/engine/dist` — the shared engine, publishable as `@speedtest/engine` on npm
- `packages/web/dist` — the static Web UI bundle
- `packages/server/dist` — the local API server
- `packages/cli/dist/index.js` — the CLI entry point (`bin: speedtest`)

**Single global install today:** `npm install -g ./packages/cli` (after `npm run build` and copying `packages/web/dist` to `packages/cli/web-dist`, which `webLauncher.ts` looks for automatically) gives you a `speedtest` command anywhere.

**Roadmap for a zero-dependency single executable / `brew install`:** package with Node's built-in [Single Executable Applications](https://nodejs.org/api/single-executable-applications.html) (`node --experimental-sea-config`) or a bundler like `pkg`/`nexe`, embedding `packages/web/dist` alongside the CLI bundle, then publish a Homebrew formula pointing at the resulting binary + a GitHub Releases artifact per platform. This is a packaging/CI concern only — the application code already has zero runtime assumptions that would block it (no native addons, no filesystem paths outside `~/.speedtest`).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Unable to reach the selected test server` | No connectivity, or the server is down. Try automatic server selection, or check your connection. |
| `<host> is rate-limiting requests right now` | You've run a lot of tests against the same public server in a short window (Cloudflare's edge, like any public service, rate-limits). Wait a bit, or switch to a self-hosted server. |
| Port already in use with `--web` | The server picks a free port automatically unless you pass `--port` explicitly; if you did, drop `--port` or choose another. |
| Web UI's live graph doesn't move | Confirm your browser allows the local page to reach the test server (an aggressive corporate proxy/firewall can block `speed.cloudflare.com`); check the browser console for network errors. |
| `npm run build -w packages/web` assets 404 after editing CSS/JS while a `--web` server is already running | Restart the CLI's `--web` process — it's serving whatever was on disk when Vite last wrote it; a rebuild while the same process is still running doesn't require a restart in production use (files are read live), but stale browser caches of old asset hashes can still 404 until you hard-reload. |

## Contributing

Issues and PRs welcome. Please run `npm run lint && npm run typecheck && npm run test` before submitting.

## License

MIT
