import type { ThemeSetting } from "@speedtest/engine";

export type View = "home" | "results" | "history" | "settings";

interface NavProps {
  view: View;
  onNavigate: (view: View) => void;
  theme: ThemeSetting;
  onThemeChange: (theme: ThemeSetting) => void;
  hasResult: boolean;
}

const THEME_ICON: Record<ThemeSetting, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};
const NEXT_THEME: Record<ThemeSetting, ThemeSetting> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export function Nav({
  view,
  onNavigate,
  theme,
  onThemeChange,
  hasResult,
}: NavProps) {
  return (
    <header className="nav">
      <button
        className="nav-brand"
        onClick={() => onNavigate("home")}
        aria-label="SpeedTest home"
      >
        <span className="nav-brand-mark" aria-hidden="true" />
        <span className="nav-brand-text">SpeedTest</span>
      </button>
      <nav className="nav-links" aria-label="Main navigation">
        <button
          className={view === "home" ? "nav-link active" : "nav-link"}
          onClick={() => onNavigate("home")}
        >
          Test
        </button>
        <button
          className={view === "results" ? "nav-link active" : "nav-link"}
          onClick={() => onNavigate("results")}
          disabled={!hasResult}
        >
          Results
        </button>
        <button
          className={view === "history" ? "nav-link active" : "nav-link"}
          onClick={() => onNavigate("history")}
        >
          History
        </button>
        <button
          className={view === "settings" ? "nav-link active" : "nav-link"}
          onClick={() => onNavigate("settings")}
        >
          Settings
        </button>
      </nav>
      <button
        className="theme-toggle"
        onClick={() => onThemeChange(NEXT_THEME[theme])}
        aria-label={`Theme: ${theme}. Click to change.`}
        title={`Theme: ${theme}`}
      >
        {THEME_ICON[theme]}
      </button>
    </header>
  );
}
