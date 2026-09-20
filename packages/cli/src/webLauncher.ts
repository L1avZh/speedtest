import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import open from "open";
import { startServer } from "@speedtest/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWebDistDir(): string | undefined {
  const candidates = [
    // Packaged layout: web assets copied alongside the CLI build.
    path.join(__dirname, "..", "web-dist"),
    // Monorepo dev layout.
    path.join(__dirname, "..", "..", "web", "dist"),
  ];
  return candidates.find((p) => existsSync(path.join(p, "index.html")));
}

export interface WebLaunchOptions {
  port?: number;
  host?: string;
  open?: boolean;
  verbose?: boolean;
  engineServer?: boolean;
}

export async function launchWeb(opts: WebLaunchOptions): Promise<void> {
  const webDistDir = resolveWebDistDir();
  if (!webDistDir) {
    console.error(
      pc.yellow(
        "⚠ Web UI assets not found. Build them first with:\n" +
          "  npm run build -w packages/web\n" +
          'Starting the API server only — the browser will show a 404 for "/".',
      ),
    );
  }

  const server = await startServer({
    port: opts.port,
    host: opts.host,
    webDistDir,
    enableEngineRoutes: opts.engineServer,
    verbose: opts.verbose,
  });

  console.log("");
  console.log(pc.bold(pc.cyan("SpeedTest Web UI")));
  console.log(`  ${pc.gray("Local:")}  ${pc.underline(server.url)}`);
  console.log(`  ${pc.gray("Data:")}   ${server.dataDir}`);
  console.log(
    `  ${pc.gray("Bind:")}   ${server.host}${server.host === "127.0.0.1" ? pc.gray("  (localhost only)") : pc.yellow("  (reachable from your network!)")}`,
  );
  console.log("");
  console.log(pc.gray("Press Ctrl+C to stop."));

  if (opts.open !== false && webDistDir) {
    await open(server.url).catch(() => {
      /* best effort — some sandboxed/headless environments have no opener */
    });
  }

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      console.log("\n" + pc.gray("Shutting down…"));
      await server.close();
      resolve();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}
