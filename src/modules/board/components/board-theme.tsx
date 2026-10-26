"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { applyTheme, readTheme } from "@/components/theme-toggle";
import { BOARD_THEME_KEY as KEY, type BoardTheme } from "../theme-script";

/**
 * The office screen's own light / dark choice, separate from the app's
 * theme: kept per screen in this browser (localStorage "boardTheme"), dark
 * until someone picks light. `?theme=light|dark` on the board's address sets
 * and remembers it, for screens nobody touches.
 */
export type { BoardTheme };
const EVENT = "vertigo:board-theme";

function read(): BoardTheme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function apply(theme: BoardTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/** Light / dark buttons for the board's footer. Leaving the board puts the app's own theme back. */
export function BoardThemeToggle() {
  const t = useTranslations("theme");
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as BoardTheme);
  useEffect(() => {
    apply(theme);
  }, [theme]);
  useEffect(() => () => applyTheme(readTheme()), []);
  const pick = (next: BoardTheme) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: lasts for this page only */
    }
    apply(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <div role="radiogroup" aria-label={t("label")} className="inline-flex rounded-md border p-0.5">
      {(
        [
          ["light", Sun],
          ["dark", Moon],
        ] as const
      ).map(([key, Icon]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={theme === key}
          aria-label={t(key)}
          title={t(key)}
          onClick={() => pick(key)}
          className={cn("flex items-center rounded px-1.5 py-0.5 transition-colors", theme === key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
