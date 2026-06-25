"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};
const ICON: Record<Theme, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

function apply(theme: Theme) {
  const el = document.documentElement;
  el.classList.toggle("dark", theme === "dark");
  el.classList.toggle("light", theme === "light");
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("charge.theme") as Theme) || "system";
    setTheme(ORDER.includes(stored) ? stored : "system");
    setMounted(true);
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("charge.theme");
      else localStorage.setItem("charge.theme", next);
    } catch {
      /* storage may be unavailable; the in-memory toggle still works */
    }
    apply(next);
  }

  // Render a stable placeholder until mounted to avoid hydration mismatch.
  const label = mounted ? LABEL[theme] : "System";
  const icon = mounted ? ICON[theme] : "◐";

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${label} (click to change)`}
      aria-label={`Color theme: ${label}. Click to change.`}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <span aria-hidden="true" className="text-sm leading-none">
        {icon}
      </span>
      <span className="tabular-nums">{label}</span>
    </button>
  );
}
