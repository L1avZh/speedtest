import pc from "picocolors";
import { HistoryStore } from "@speedtest/server";
import { resultsToCsv, formatMbps, formatMs } from "@speedtest/engine";

export interface HistoryCommandOptions {
  json?: boolean;
  csv?: boolean;
  clear?: boolean;
  limit?: number;
}

export async function runHistoryCommand(
  opts: HistoryCommandOptions,
): Promise<void> {
  const store = new HistoryStore();

  if (opts.clear) {
    await store.clear();
    console.log(pc.green("✓ History cleared."));
    return;
  }

  const all = await store.list();
  const results = opts.limit ? all.slice(0, opts.limit) : all;

  if (opts.json) {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    return;
  }
  if (opts.csv) {
    process.stdout.write(resultsToCsv(results) + "\n");
    return;
  }

  if (results.length === 0) {
    console.log(
      pc.gray(
        "No test history yet. Run `speedtest` to record your first result.",
      ),
    );
    return;
  }

  console.log(pc.bold(`Test History (${results.length})`));
  console.log("");
  for (const r of results) {
    const when = new Date(r.timestamp).toLocaleString();
    console.log(
      `  ${pc.gray(when)}   ${pc.bold(formatMbps(r.download.mbps))} ↓   ${pc.bold(formatMbps(r.upload.mbps))} ↑   ${formatMs(r.latency.avgMs)}   ${pc.dim(r.id.slice(0, 8))}`,
    );
  }
}
