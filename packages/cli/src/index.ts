#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import pc from "picocolors";
import { HistoryStore, SettingsStore } from "@speedtest/server";
import { runCli } from "./run.js";
import { launchWeb } from "./webLauncher.js";
import { pickInterface } from "./picker.js";
import { runHistoryCommand } from "./historyCmd.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("speedtest")
  // Without this, an option flag shared between the root command and a
  // subcommand (e.g. --json on both `speedtest` and `speedtest history`)
  // gets greedily consumed by the root parser wherever it appears in
  // argv, so the subcommand never sees it. Positional parsing makes
  // options belong to whichever command they appear after.
  .enablePositionalOptions()
  .description(
    "A professional internet speed test — real download/upload/latency/jitter/packet-loss measurements from your terminal or a local web UI.",
  )
  .version(pkg.version, "--version", "Show the installed version")
  .option("--json", "Output machine-readable JSON and skip decorative output")
  .option("--csv", "Output a single CSV row and skip decorative output")
  .option("--server <id>", "Force a specific test server id")
  .option("--no-download", "Skip the download test")
  .option("--no-upload", "Skip the upload test")
  .option("--timeout <seconds>", "Per-request timeout in seconds", "15")
  .option("--verbose", "Show additional diagnostic detail")
  .option("--cli", "Force CLI mode (skip the interactive picker)")
  .option("--web", "Launch the local Web UI instead of running a terminal test")
  .option("--port <number>", "Port for --web (default: automatic)")
  .option(
    "--host <address>",
    "Bind address for --web (default: 127.0.0.1, localhost only)",
  )
  .option("--no-open", "With --web, don't automatically open a browser tab")
  .option(
    "--engine-server",
    "With --web, also expose this machine as a self-hosted test server (/__down, /__up)",
  )
  .option("--no-save", "Don't record this result in local history")
  .action(async (opts) => {
    if (opts.web) {
      await launchWeb({
        port: opts.port ? Number(opts.port) : undefined,
        host: opts.host,
        open: opts.open,
        verbose: opts.verbose,
        engineServer: opts.engineServer,
      });
      return;
    }

    const machineReadable = Boolean(opts.json || opts.csv);
    let mode: "cli" | "web" = "cli";
    if (!opts.cli && !machineReadable && process.stdout.isTTY) {
      mode = await pickInterface();
    }

    if (mode === "web") {
      await launchWeb({ verbose: opts.verbose });
      return;
    }

    const settingsStore = new SettingsStore();
    const settings = await settingsStore.get();
    const historyStore = new HistoryStore();

    try {
      await runCli({
        json: opts.json,
        csv: opts.csv,
        verbose: opts.verbose,
        serverId: opts.server,
        enableDownload: opts.download !== false,
        enableUpload: opts.upload !== false,
        timeoutMs: Number(opts.timeout) * 1000,
        downloadDurationMs: settings.testing.downloadDurationMs,
        uploadDurationMs: settings.testing.uploadDurationMs,
        downloadConnections: settings.testing.downloadConnections,
        uploadConnections: settings.testing.uploadConnections,
        latencySamples: settings.testing.latencySamples,
        customServers: settings.testing.customServers,
        networkInfoLookup: settings.privacy.networkInfoLookup,
        saveHistory:
          opts.save !== false && settings.privacy.localHistoryEnabled
            ? async (result) => {
                await historyStore.add(result);
              }
            : undefined,
      });
    } catch {
      process.exit(process.exitCode ?? 1);
    }
  });

const historyCmd = program
  .command("history")
  .description("View, export, or clear locally saved test results");
historyCmd
  .option("--json", "Output as JSON")
  .option("--csv", "Output as CSV")
  .option("--clear", "Delete all saved history")
  .option("--limit <n>", "Limit number of entries shown", (v) => Number(v))
  .action(async (opts) => {
    await runHistoryCommand(opts);
  });

program.addHelpText(
  "after",
  `\n${pc.gray("Examples:")}\n` +
    `  $ speedtest\n` +
    `  $ speedtest --json\n` +
    `  $ speedtest --no-upload --timeout 30\n` +
    `  $ speedtest --web --port 8080\n` +
    `  $ speedtest history --csv > history.csv\n`,
);

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
