import { useCallback, useEffect, useState } from "react";

// Theme choices shown in the picker. "system" follows the device (dark mode / high contrast settings).
export const THEMES = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "contrast", label: "High contrast", icon: "contrast" },
  { value: "system", label: "Match device", icon: "monitor" },
];

const KEY = "cc-theme";
const META = { light: "#faf8f4", dark: "#121715", contrast: "#ffffff" };

export function getStoredTheme() {
  try {
    const value = localStorage.getItem(KEY);
    return THEMES.some((t) => t.value === value) ? value : "system";
  } catch {
    return "system";
  }
}

const media = (query) => typeof window !== "undefined" && window.matchMedia?.(query).matches;

/** The theme actually shown for a choice ("system" becomes light, dark or contrast). */
export function resolveTheme(choice) {
  if (choice !== "system") return choice;
  if (media("(prefers-contrast: more)")) return "contrast";
  return media("(prefers-color-scheme: dark)") ? "dark" : "light";
}

export function applyTheme(choice, { animate = false } = {}) {
  const theme = resolveTheme(choice);
  const root = document.documentElement;
  // A short crossfade between themes (skipped for reduced-motion users by the global CSS rule)
  if (animate) {
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 350);
  }
  root.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META[theme]);
  return theme;
}

/** Current theme choice, a setter that saves it, and live updates when the device setting changes. */
export function useTheme() {
  const [choice, setChoice] = useState(getStoredTheme);

  const choose = useCallback((value) => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* storage blocked: the theme still applies for this visit */
    }
    setChoice(value);
    applyTheme(value, { animate: true });
  }, []);

  useEffect(() => {
    applyTheme(choice);
    if (choice !== "system" || !window.matchMedia) return undefined;
    const queries = [window.matchMedia("(prefers-color-scheme: dark)"), window.matchMedia("(prefers-contrast: more)")];
    const onChange = () => applyTheme("system", { animate: true });
    queries.forEach((q) => q.addEventListener?.("change", onChange));
    return () => queries.forEach((q) => q.removeEventListener?.("change", onChange));
  }, [choice]);

  return [choice, choose];
}
