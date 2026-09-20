import pc from "picocolors";
import type { TestResult } from "@speedtest/engine";
import {
  formatMbps,
  formatMs,
  formatPercent,
  formatDuration,
  qualityLabel,
} from "@speedtest/engine";
import { headerBox, rule, row } from "./box.js";
import { qualityColor, theme } from "./theme.js";

export function renderReport(result: TestResult, verbose: boolean): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(headerBox("SPEEDTEST RESULTS"));
  lines.push("");

  lines.push(theme.heading("Network"));
  lines.push(
    row("Server", `${result.server.name} (${result.server.location})`),
  );
  if (result.server.colo) lines.push(row("Edge", result.server.colo));
  if (result.network.isp) lines.push(row("ISP", result.network.isp));
  if (result.network.ip) lines.push(row("IP", result.network.ip));
  lines.push(row("Protocol", result.network.protocol));
  lines.push("");

  lines.push(theme.heading("Latency"));
  lines.push(
    row(
      "Ping",
      `${formatMs(result.latency.avgMs)} ${pc.dim(`(min ${formatMs(result.latency.minMs)} / max ${formatMs(result.latency.maxMs)})`)}`,
    ),
  );
  lines.push(row("Jitter", formatMs(result.latency.jitterMs)));
  lines.push(row("Packet Loss", formatPercent(result.latency.lossPercent)));
  lines.push("");

  lines.push(theme.heading("Download"));
  lines.push(
    `  ${pc.bold(formatMbps(result.download.mbps))}  ${pc.dim(`peak ${formatMbps(result.download.peakMbps)}`)}`,
  );
  lines.push("");
  lines.push(theme.heading("Upload"));
  lines.push(
    `  ${pc.bold(formatMbps(result.upload.mbps))}  ${pc.dim(`peak ${formatMbps(result.upload.peakMbps)}`)}`,
  );
  lines.push("");

  lines.push(rule());
  lines.push("");
  lines.push(
    `${theme.heading("Network Quality:")} ${qualityColor(result.quality.overall, qualityLabel(result.quality.overall))}`,
  );
  lines.push(
    row(
      "Download",
      qualityColor(
        result.quality.download,
        qualityLabel(result.quality.download),
      ),
      12,
    ) +
      "   " +
      row(
        "Upload",
        qualityColor(
          result.quality.upload,
          qualityLabel(result.quality.upload),
        ),
        8,
      ).trimStart(),
  );
  lines.push(
    row(
      "Latency",
      qualityColor(
        result.quality.latency,
        qualityLabel(result.quality.latency),
      ),
      12,
    ) +
      "   " +
      row(
        "Stability",
        qualityColor(
          result.quality.stability,
          qualityLabel(result.quality.stability),
        ),
        8,
      ).trimStart(),
  );
  lines.push("");

  const suitable = result.recommendations.filter((r) => r.suitable);
  if (suitable.length > 0) {
    lines.push(theme.heading("Well suited for:"));
    for (const rec of suitable) {
      lines.push(`  ${pc.green("✓")} ${rec.label}`);
    }
    lines.push("");
  }
  const unsuitable = result.recommendations.filter((r) => !r.suitable);
  if (unsuitable.length > 0 && verbose) {
    lines.push(theme.heading("May struggle with:"));
    for (const rec of unsuitable) {
      lines.push(`  ${pc.red("✗")} ${rec.label} ${pc.dim(`(${rec.reason})`)}`);
    }
    lines.push("");
  }

  lines.push(rule());
  lines.push(
    pc.dim(
      `Test completed in ${formatDuration(result.durationMs)} · ${new Date(result.timestamp).toLocaleString()}`,
    ),
  );
  lines.push("");

  return lines.join("\n");
}
