"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";

export type Theme = "light" | "dark" | "system";
const KEY = "theme";

/**
 * Inline script for <head>: applies the saved theme (or the system one)
 * before the first paint so a dark page never flashes light. Keep in sync
 * with applyTheme below.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "dark" || t === "light" ? t : "system";
  } catch {
    return "system";
  }
}

const EVENT = "vertigo:theme";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/** Light / dark / system switch; the choice lives in this browser (localStorage) and is shared between open tabs. */
export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations("theme");
  // Read from localStorage as an external store: "system" on the server, the saved value once hydrated.
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => readTheme() === "system" && applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const pick = (next: Theme) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    applyTheme(next);
    window.dispatchEvent(new Event(EVENT));
  };
  const options: { key: Theme; icon: typeof Sun }[] = [
    { key: "light", icon: Sun },
    { key: "dark", icon: Moon },
    { key: "system", icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label={t("label")} className={cn("inline-flex rounded-md border p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={theme === o.key}
          aria-label={t(o.key)}
          title={t(o.key)}
          onClick={() => pick(o.key)}
          className={cn("flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors", theme === o.key ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <o.icon className="size-4" aria-hidden />
          {!compact && <span>{t(o.key)}</span>}
        </button>
      ))}
    </div>
  );
}
