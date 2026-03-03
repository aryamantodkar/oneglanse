"use client";

import { STORAGE_KEY } from "@/lib/landing-content";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

export function ThemeToggle(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const isDark = theme === "dark";

  const handleToggle = () => {
    const next: ThemeMode = isDark ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
