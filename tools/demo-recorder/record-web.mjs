// Records a real, driven browser session against the actual running
// `speedtest --web` server and saves it as a .webm video (converted to
// GIF separately via ffmpeg). Every number shown is a genuine measurement
// from the live page — this script only automates clicks/waits, it does
// not inject or fake any data.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://127.0.0.1:7341";
const OUT_DIR = process.argv[3] || "docs/demo/web-video";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 760, height: 720 },
  recordVideo: { dir: OUT_DIR, size: { width: 760, height: 720 } },
});
const page = await context.newPage();

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

await page.getByRole("button", { name: "Run Test" }).click();

// Let the full test run (latency + download + upload) play out and settle
// on the Results screen.
await page.waitForTimeout(600);
await page.waitForSelector("text=Testing latency", { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1800);
await page.waitForSelector("text=Testing download", { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(5200);
await page.waitForSelector("text=Testing upload", { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(4200);
await page.waitForSelector("text=Your Results", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(2500);

// Quick scroll through the results dashboard.
await page.mouse.wheel(0, 500);
await page.waitForTimeout(1500);

await context.close();
await browser.close();
console.log("Recording complete, saved under", OUT_DIR);
