import type { AppSettings, SettingsPatch, TestResult } from "@speedtest/engine";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API error: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  async getSettings(): Promise<AppSettings> {
    return json(await fetch("/api/settings"));
  },
  async updateSettings(patch: SettingsPatch): Promise<AppSettings> {
    return json(
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    );
  },
  async resetSettings(): Promise<AppSettings> {
    return json(await fetch("/api/settings/reset", { method: "POST" }));
  },
  async getHistory(): Promise<TestResult[]> {
    return json(await fetch("/api/history"));
  },
  async saveResult(result: TestResult): Promise<TestResult[]> {
    return json(
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      }),
    );
  },
  async deleteResult(id: string): Promise<TestResult[]> {
    return json(
      await fetch(`/api/history/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    );
  },
  async clearHistory(): Promise<void> {
    await fetch("/api/history", { method: "DELETE" });
  },
  async getMeta(): Promise<{
    dataDir: string;
    privacy: Record<string, unknown>;
  }> {
    return json(await fetch("/api/meta"));
  },
};
