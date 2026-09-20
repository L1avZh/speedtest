import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { TestResult } from "@speedtest/engine";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type AppSettings,
  type SettingsPatch,
} from "@speedtest/engine";

export function defaultDataDir(): string {
  return path.join(os.homedir(), ".speedtest");
}

const MAX_HISTORY_ENTRIES = 1000;

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    // Corrupt file: back it up rather than silently discarding user data.
    try {
      if (existsSync(filePath)) {
        await rename(filePath, `${filePath}.corrupt-${Date.now()}.bak`);
      }
    } catch {
      /* best effort */
    }
    return fallback;
  }
}

async function writeJsonFileAtomic(
  filePath: string,
  data: unknown,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, filePath);
}

/**
 * File-backed test history, shared by the CLI and the local web API so a
 * test run from either interface shows up in both. Stored under
 * ~/.speedtest/history.json (or a custom dataDir) as plain JSON — no
 * database, no cloud sync, nothing leaves the machine.
 */
export class HistoryStore {
  private readonly filePath: string;

  constructor(dataDir: string = defaultDataDir()) {
    this.filePath = path.join(dataDir, "history.json");
  }

  async list(): Promise<TestResult[]> {
    return readJsonFile<TestResult[]>(this.filePath, []);
  }

  async add(result: TestResult): Promise<TestResult[]> {
    const current = await this.list();
    const next = [result, ...current].slice(0, MAX_HISTORY_ENTRIES);
    await writeJsonFileAtomic(this.filePath, next);
    return next;
  }

  async remove(id: string): Promise<TestResult[]> {
    const current = await this.list();
    const next = current.filter((r) => r.id !== id);
    await writeJsonFileAtomic(this.filePath, next);
    return next;
  }

  async clear(): Promise<void> {
    await writeJsonFileAtomic(this.filePath, []);
  }
}

/**
 * File-backed application settings under ~/.speedtest/settings.json,
 * shared by the CLI and the local web API.
 */
export class SettingsStore {
  private readonly filePath: string;

  constructor(dataDir: string = defaultDataDir()) {
    this.filePath = path.join(dataDir, "settings.json");
  }

  async get(): Promise<AppSettings> {
    const stored = await readJsonFile<SettingsPatch>(this.filePath, {});
    return mergeSettings(DEFAULT_SETTINGS, stored);
  }

  async update(patch: SettingsPatch): Promise<AppSettings> {
    const current = await this.get();
    const next = mergeSettings(current, patch);
    await writeJsonFileAtomic(this.filePath, next);
    return next;
  }

  async reset(): Promise<AppSettings> {
    await writeJsonFileAtomic(this.filePath, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
}
