import { useState } from "react";
import type { AppSettings, SettingsPatch } from "@speedtest/engine";

interface SettingsScreenProps {
  settings: AppSettings;
  dataDir: string | null;
  onUpdate: (patch: SettingsPatch) => Promise<AppSettings>;
  onReset: () => Promise<AppSettings>;
}

type Tab = "general" | "testing" | "privacy" | "advanced";

export function SettingsScreen({
  settings,
  dataDir,
  onUpdate,
  onReset,
}: SettingsScreenProps) {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="settings-screen">
      <h1>Settings</h1>
      <div className="settings-tabs" role="tablist">
        {(["general", "testing", "privacy", "advanced"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "settings-tab active" : "settings-tab"}
            onClick={() => setTab(t)}
          >
            {t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="settings-panel">
          <label className="settings-row">
            <span>Theme</span>
            <select
              value={settings.general.theme}
              onChange={(e) =>
                onUpdate({
                  general: {
                    theme: e.target.value as AppSettings["general"]["theme"],
                  },
                })
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="settings-row">
            <span>Units</span>
            <select
              value={settings.general.units}
              onChange={(e) =>
                onUpdate({
                  general: {
                    units: e.target.value as AppSettings["general"]["units"],
                  },
                })
              }
            >
              <option value="mbps">Mbps (megabits/sec)</option>
              <option value="MBps">MB/s (megabytes/sec)</option>
            </select>
          </label>
          <label className="settings-row">
            <span>Default interface</span>
            <select
              value={settings.general.defaultInterface}
              onChange={(e) =>
                onUpdate({
                  general: {
                    defaultInterface: e.target
                      .value as AppSettings["general"]["defaultInterface"],
                  },
                })
              }
            >
              <option value="web">Web</option>
              <option value="cli">CLI</option>
            </select>
          </label>
        </div>
      )}

      {tab === "testing" && (
        <div className="settings-panel">
          <label className="settings-row">
            <span>Download duration</span>
            <NumberInput
              value={settings.testing.downloadDurationMs / 1000}
              min={3}
              max={30}
              suffix="s"
              onChange={(v) =>
                onUpdate({ testing: { downloadDurationMs: v * 1000 } })
              }
            />
          </label>
          <label className="settings-row">
            <span>Upload duration</span>
            <NumberInput
              value={settings.testing.uploadDurationMs / 1000}
              min={3}
              max={30}
              suffix="s"
              onChange={(v) =>
                onUpdate({ testing: { uploadDurationMs: v * 1000 } })
              }
            />
          </label>
          <label className="settings-row">
            <span>Download connections</span>
            <NumberInput
              value={settings.testing.downloadConnections}
              min={1}
              max={8}
              onChange={(v) =>
                onUpdate({ testing: { downloadConnections: v } })
              }
            />
          </label>
          <label className="settings-row">
            <span>Upload connections</span>
            <NumberInput
              value={settings.testing.uploadConnections}
              min={1}
              max={8}
              onChange={(v) => onUpdate({ testing: { uploadConnections: v } })}
            />
          </label>
          <label className="settings-row">
            <span>Latency samples</span>
            <NumberInput
              value={settings.testing.latencySamples}
              min={3}
              max={30}
              onChange={(v) => onUpdate({ testing: { latencySamples: v } })}
            />
          </label>
          <label className="settings-row">
            <span>Timeout</span>
            <NumberInput
              value={settings.testing.timeoutMs / 1000}
              min={5}
              max={60}
              suffix="s"
              onChange={(v) => onUpdate({ testing: { timeoutMs: v * 1000 } })}
            />
          </label>
          <label className="settings-row">
            <span>Server selection</span>
            <select
              value={settings.testing.serverSelection}
              onChange={(e) =>
                onUpdate({
                  testing: {
                    serverSelection: e.target
                      .value as AppSettings["testing"]["serverSelection"],
                  },
                })
              }
            >
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </label>
        </div>
      )}

      {tab === "privacy" && (
        <div className="settings-panel">
          <Toggle
            label="Save test results locally"
            description="Stores results as plain JSON on this machine only, under your home directory. Never uploaded anywhere."
            checked={settings.privacy.localHistoryEnabled}
            onChange={(v) => onUpdate({ privacy: { localHistoryEnabled: v } })}
          />
          <Toggle
            label="Look up ISP / IP details"
            description="Queries ipwho.is (a third-party geolocation service) directly from your browser to show your ISP name and approximate location. Disable to skip this — your test still runs normally."
            checked={settings.privacy.networkInfoLookup}
            onChange={(v) => onUpdate({ privacy: { networkInfoLookup: v } })}
          />
          <div className="privacy-note">
            <h3>What this app does and doesn't do</h3>
            <ul>
              <li>No analytics, telemetry, or crash reporting of any kind.</li>
              <li>
                Test data is exchanged only with the test server you select
                (Cloudflare's public edge by default) and, if enabled above,
                ipwho.is for ISP info.
              </li>
              <li>
                History and settings live in {dataDir ?? "~/.speedtest"} as
                plain JSON files you can open, back up, or delete yourself.
              </li>
              <li>
                The local API server only accepts requests from this machine
                (127.0.0.1) unless you explicitly bind it wider.
              </li>
            </ul>
          </div>
        </div>
      )}

      {tab === "advanced" && (
        <div className="settings-panel">
          <Toggle
            label="Debug logging"
            description="Verbose server-side request logging."
            checked={settings.advanced.debugLogging}
            onChange={(v) => onUpdate({ advanced: { debugLogging: v } })}
          />
          <Toggle
            label="Verbose mode"
            description="Show additional diagnostic detail in results."
            checked={settings.advanced.verbose}
            onChange={(v) => onUpdate({ advanced: { verbose: v } })}
          />
          <label className="settings-row">
            <span>Port</span>
            <NumberInput
              value={settings.advanced.port}
              min={1024}
              max={65535}
              onChange={(v) => onUpdate({ advanced: { port: v } })}
            />
          </label>
          <Toggle
            label="Bind all network interfaces"
            description="Off by default for security — the local server only listens on 127.0.0.1. Turning this on makes the Web UI reachable from other devices on your network."
            checked={settings.advanced.bindAllInterfaces}
            onChange={(v) => onUpdate({ advanced: { bindAllInterfaces: v } })}
          />
          <button
            className="btn btn-ghost btn-danger"
            onClick={() => void onReset()}
          >
            Reset all settings to defaults
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="settings-toggle-row">
      <div>
        <span className="toggle-label">{label}</span>
        <p className="toggle-description">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        className={checked ? "switch on" : "switch"}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-thumb" />
      </button>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <span className="number-input">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
      />
      {suffix && <span className="number-suffix">{suffix}</span>}
    </span>
  );
}
