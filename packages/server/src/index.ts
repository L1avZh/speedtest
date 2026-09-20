import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import getPort from "get-port";
import type { SettingsPatch, TestResult } from "@speedtest/engine";
import { HistoryStore, SettingsStore, defaultDataDir } from "./storage.js";
import { registerEngineRoutes } from "./engineRoutes.js";

export interface StartServerOptions {
  port?: number;
  /** Bind address. Defaults to loopback-only; binding wider requires an explicit opt-in (see README > Security). */
  host?: string;
  dataDir?: string;
  /** Directory containing the built web app (packages/web/dist) to serve statically. */
  webDistDir?: string;
  /** Also mount the self-hosted measurement-engine protocol (/__down, /__up, /__meta). */
  enableEngineRoutes?: boolean;
  verbose?: boolean;
}

export interface RunningServer {
  url: string;
  port: number;
  host: string;
  dataDir: string;
  close: () => Promise<void>;
}

const DEFAULT_PORT = 7337;

/**
 * Starts the local API server. Binds to 127.0.0.1 by default (never all
 * interfaces unless `host` is explicitly overridden) and only accepts
 * cross-origin requests from other localhost/127.0.0.1 origins, so a page
 * on the public internet cannot use this server as a confused deputy
 * against the user's machine or files.
 */
export async function startServer(
  opts: StartServerOptions = {},
): Promise<RunningServer> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? (await getPort({ port: DEFAULT_PORT }));
  const dataDir = opts.dataDir ?? defaultDataDir();
  const history = new HistoryStore(dataDir);
  const settingsStore = new SettingsStore(dataDir);

  const app = Fastify({ logger: opts.verbose ?? false, bodyLimit: 2_000_000 });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      try {
        const { hostname } = new URL(origin);
        const isLocal =
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "::1";
        cb(null, isLocal);
      } catch {
        cb(null, false);
      }
    },
  });

  app.addContentTypeParser("application/octet-stream", (_req, _payload, done) =>
    done(null),
  );

  app.get("/api/health", async () => ({ status: "ok" }));

  app.get("/api/settings", async () => settingsStore.get());
  app.put<{ Body: SettingsPatch }>("/api/settings", async (req) =>
    settingsStore.update(req.body),
  );
  app.post("/api/settings/reset", async () => settingsStore.reset());

  app.get("/api/history", async () => history.list());
  app.post<{ Body: TestResult }>("/api/history", async (req, reply) => {
    const result = req.body;
    if (!result || typeof result.id !== "string") {
      return reply.status(400).send({ error: "Invalid test result payload" });
    }
    return history.add(result);
  });
  app.delete<{ Params: { id: string } }>("/api/history/:id", async (req) =>
    history.remove(req.params.id),
  );
  app.delete("/api/history", async () => {
    await history.clear();
    return { ok: true };
  });

  app.get("/api/meta", async () => ({
    dataDir,
    privacy: {
      historyStoredLocally: true,
      historyLeavesDevice: false,
      networkInfoLookupProvider:
        "ipwho.is (third-party, optional, see Settings > Privacy)",
      telemetry: false,
    },
  }));

  if (opts.enableEngineRoutes) {
    registerEngineRoutes(app);
  }

  if (opts.webDistDir) {
    await app.register(fastifyStatic, {
      root: opts.webDistDir,
      wildcard: false,
    });
    app.setNotFoundHandler((req, reply) => {
      const url = req.raw.url ?? "";
      // Only fall back to index.html for client-side route navigation
      // (no file extension) — a missing hashed asset (e.g. a stale
      // /assets/*.js reference from a page loaded before a rebuild) must
      // stay a real 404, or the browser gets HTML back where it expected
      // a JS module and refuses to execute it.
      const looksLikeAsset = /\.[a-zA-Z0-9]+$/.test(url.split("?")[0] ?? "");
      if (
        req.raw.method === "GET" &&
        !url.startsWith("/api") &&
        !looksLikeAsset
      ) {
        return reply.sendFile("index.html");
      }
      reply.status(404).send({ error: "Not found" });
    });
  }

  await app.listen({ port, host });

  return {
    url: `http://${host}:${port}`,
    port,
    host,
    dataDir,
    close: async () => {
      await app.close();
    },
  };
}

export { HistoryStore, SettingsStore, defaultDataDir } from "./storage.js";
export { registerEngineRoutes } from "./engineRoutes.js";
