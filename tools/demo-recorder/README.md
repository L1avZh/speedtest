# demo-recorder

Not part of the shipped application — these are the scripts used to record the README GIFs (`docs/demo/*.gif`). Kept in their own package so Playwright never becomes a dependency of the actual product.

- `throttled-server.mjs` — a standalone server speaking the same minimal protocol as `packages/server/src/engineRoutes.ts` (`/__down`, `/__up`, `/__meta`), but with deliberate bandwidth pacing so a local recording shows realistic home-internet numbers (hundreds of Mbps) instead of raw loopback speed (tens of Gbps). Every byte is still genuinely generated and transferred; only the rate is capped.
- `record-web.mjs` — drives a real Chromium instance (via Playwright) against an actual running `speedtest --web` server, clicks "Run Test", and records the session as video.

To reproduce:

```bash
npm install
npx playwright install chromium

# CLI GIF (requires asciinema + agg: brew install asciinema agg)
node ../../tools/demo-recorder/throttled-server.mjs 7340 &
# point ~/.speedtest/settings.json testing.customServers at http://127.0.0.1:7340
asciinema rec cli-demo.cast --headless --window-size 100x30 \
  --command "speedtest --cli --server <your-custom-server-id>"
agg cli-demo.cast cli-demo.gif --theme dracula --font-size 16

# Web GIF (requires ffmpeg: brew install ffmpeg)
speedtest --web --no-open --port 7341 &
node record-web.mjs http://127.0.0.1:7341
ffmpeg -i web-video/*.webm -vf "fps=7,scale=620:-1,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" web-demo.gif
```
