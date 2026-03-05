"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

type ThemeChoice = "light" | "dark" | "system";
const themeOrder: ThemeChoice[] = ["light", "dark", "system"];

function nextTheme(current: string | undefined): ThemeChoice {
  const active = current === "light" || current === "dark" || current === "system" ? current : "light";
  const index = themeOrder.indexOf(active);
  return themeOrder[(index + 1) % themeOrder.length];
}

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const active = useMemo<ThemeChoice>(() => {
    if (theme === "light" || theme === "dark" || theme === "system") return theme;
    return "light";
  }, [theme]);

  if (!isClient) {
    return (
      <button
        type="button"
        aria-label="Theme"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/80 text-muted-foreground"
        disabled
      >
        <span className="text-xs">T</span>
      </button>
    );
  }

  const label = active === "system" ? `Theme: system (${resolvedTheme ?? "light"})` : `Theme: ${active}`;
  const upcoming = nextTheme(theme);

  return (
    <button
      type="button"
      aria-label={label}
      title={`${label}. Click to switch to ${upcoming}.`}
      onClick={() => setTheme(upcoming)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/80 text-foreground transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
    >
      {active === "light" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
        </svg>
      ) : active === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20.4 14.7a8 8 0 1 1-11.1-11 8.5 8.5 0 0 0 11.1 11Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3.5" y="4.5" width="17" height="12" rx="1.8" />
          <path d="M9.5 20h5M12 16.5V20" />
        </svg>
      )}
    </button>
  );
}
