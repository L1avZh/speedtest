import {
  runSpeedTest,
  resultToJson,
  resultToCsv,
  type ProgressEvent,
  type RunTestOptions,
  type TestResult,
} from "@speedtest/engine";
import { Spinner } from "./render/liveBlock.js";
import { TransferDashboard } from "./render/transferDashboard.js";
import { renderReport } from "./render/report.js";
import { renderError } from "./errors.js";
import { theme } from "./render/theme.js";
import { headerBox } from "./render/box.js";

export interface CliRunOptions extends RunTestOptions {
  json?: boolean;
  csv?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  saveHistory?: (result: TestResult) => Promise<void>;
}

export async function runCli(options: CliRunOptions): Promise<TestResult> {
  const machineReadable = Boolean(options.json || options.csv);

  let spinner: Spinner | null = null;
  let downloadDash: TransferDashboard | null = null;
  let uploadDash: TransferDashboard | null = null;

  if (!machineReadable) {
    console.log(headerBox("SPEEDTEST"));
    console.log("");
  }

  const onProgress = (event: ProgressEvent) => {
    if (machineReadable) return;

    switch (event.phase) {
      case "checking-connectivity":
      case "selecting-server":
        if (!spinner) {
          spinner = new Spinner();
          spinner.start(event.message);
        } else {
          spinner.update(event.message);
        }
        if (event.server) {
          spinner.stop(
            `Server: ${event.server.name} (${event.server.location})`,
          );
          spinner = null;
        }
        break;
      case "testing-latency":
        if (!spinner) {
          spinner = new Spinner();
          spinner.start("Measuring latency…");
        }
        if (event.latency) {
          spinner.stop(
            `Latency ${event.latency.avgMs.toFixed(1)} ms · Jitter ${event.latency.jitterMs.toFixed(1)} ms · Loss ${event.latency.lossPercent.toFixed(1)}%`,
          );
          spinner = null;
        }
        break;
      case "testing-download":
        if (!downloadDash) {
          downloadDash = new TransferDashboard("Download", theme.bar);
          console.log("");
        }
        if (event.live) {
          downloadDash.render(
            event.live.currentMbps,
            event.live.avgMbps,
            event.live.peakMbps,
            event.progress ?? 0,
          );
        }
        break;
      case "testing-upload":
        if (downloadDash) {
          downloadDash.finish();
          downloadDash = null;
        }
        if (!uploadDash) {
          uploadDash = new TransferDashboard("Upload  ", theme.barUpload);
          console.log("");
        }
        if (event.live) {
          uploadDash.render(
            event.live.currentMbps,
            event.live.avgMbps,
            event.live.peakMbps,
            event.progress ?? 0,
          );
        }
        break;
      case "analyzing":
        if (uploadDash) {
          uploadDash.finish();
          uploadDash = null;
        }
        if (!spinner) {
          spinner = new Spinner();
        }
        spinner.start(event.message);
        break;
      default:
        break;
    }
  };

  try {
    const result = await runSpeedTest({ ...options, onProgress });
    if (spinner) (spinner as Spinner).stop("Analysis complete");

    if (options.json) {
      process.stdout.write(resultToJson(result) + "\n");
    } else if (options.csv) {
      process.stdout.write(resultToCsv(result) + "\n");
    } else {
      console.log(renderReport(result, options.verbose ?? false));
    }

    if (options.saveHistory) {
      await options.saveHistory(result);
    }

    return result;
  } catch (err) {
    if (spinner) (spinner as Spinner).stop("Test failed", "✗");
    if (machineReadable) {
      process.stderr.write(
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }) + "\n",
      );
    } else {
      console.error("");
      console.error(renderError(err));
    }
    process.exitCode = 1;
    throw err;
  }
}
