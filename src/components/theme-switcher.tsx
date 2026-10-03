"use client";

import { useState } from "react";
import { THEME_COOKIE, THEMES, type Theme } from "@/lib/theme";

const labels: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

/** One button that cycles System → Light → Dark. */
export function ThemeSwitcher({ initial, className = "" }: { initial: Theme; className?: string }) {
  const [theme, setTheme] = useState(initial);
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  function apply(value: Theme) {
    setTheme(value);
    const root = document.documentElement;
    if (value === "system") delete root.dataset.theme;
    else root.dataset.theme = value;
    document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      data-cta="theme_toggle"
      aria-label={`Theme: ${labels[theme]}. Switch to ${labels[next]}.`}
      title={`Theme: ${labels[theme]}`}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-ink-muted hover:text-ink ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {theme === "light" && (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        )}
        {theme === "dark" && <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />}
        {theme === "system" && (
          <>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </>
        )}
      </svg>
    </button>
  );
}
