import type { QualityThresholds } from "./quality.js";
import { DEFAULT_THRESHOLDS } from "./quality.js";
import type { TestServer } from "./types.js";

export type ThemeSetting = "system" | "light" | "dark";
export type UnitsSetting = "mbps" | "MBps";
export type DefaultInterface = "cli" | "web";

export interface AppSettings {
  general: {
    theme: ThemeSetting;
    units: UnitsSetting;
    defaultInterface: DefaultInterface;
  };
  testing: {
    downloadDurationMs: number;
    uploadDurationMs: number;
    downloadConnections: number;
    uploadConnections: number;
    latencySamples: number;
    timeoutMs: number;
    serverSelection: "automatic" | "manual";
    manualServerId?: string;
    customServers: TestServer[];
  };
  privacy: {
    localHistoryEnabled: boolean;
    networkInfoLookup: boolean;
  };
  advanced: {
    debugLogging: boolean;
    verbose: boolean;
    port: number;
    bindAllInterfaces: boolean;
    thresholds: QualityThresholds;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    theme: "system",
    units: "mbps",
    defaultInterface: "web",
  },
  testing: {
    downloadDurationMs: 10000,
    uploadDurationMs: 8000,
    downloadConnections: 4,
    uploadConnections: 3,
    latencySamples: 12,
    timeoutMs: 15000,
    serverSelection: "automatic",
    customServers: [],
  },
  privacy: {
    localHistoryEnabled: true,
    networkInfoLookup: true,
  },
  advanced: {
    debugLogging: false,
    verbose: false,
    port: 7337,
    bindAllInterfaces: false,
    thresholds: DEFAULT_THRESHOLDS,
  },
};

export type SettingsPatch = DeepPartial<AppSettings>;

export function mergeSettings(
  base: AppSettings,
  patch: SettingsPatch,
): AppSettings {
  return {
    general: { ...base.general, ...patch.general },
    testing: { ...base.testing, ...patch.testing },
    privacy: { ...base.privacy, ...patch.privacy },
    advanced: {
      ...base.advanced,
      ...patch.advanced,
      thresholds: {
        ...base.advanced.thresholds,
        ...patch.advanced?.thresholds,
      },
    },
  };
}

type DeepPartial<T> = { [K in keyof T]?: Partial<T[K]> };
