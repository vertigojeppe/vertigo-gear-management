"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { isoWeek } from "@/lib/dates";
import { appConfig } from "../../../../config/app.config";

/**
 * Keeps the office screen current without anyone touching it: the data is
 * re-read every minute while the page is visible (and at once when it
 * becomes visible again), and the session is touched every half hour so
 * the screen account never gets signed out by an expiring cookie.
 */
export function BoardRefresh({ everySeconds = 60 }: { everySeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const data = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everySeconds * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Reading the session re-issues the session cookie with a fresh expiry.
    const session = setInterval(() => void fetch("/api/auth/session", { cache: "no-store" }).catch(() => undefined), 30 * 60_000);
    return () => {
      clearInterval(data);
      clearInterval(session);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, everySeconds]);
  return null;
}

/**
 * A box that shows everything on a screen nobody touches: when its content
 * is taller than the box, it scrolls slowly to the bottom, waits, and
 * starts again from the top. Content that fits stays still.
 */
export function BoardAutoScroll({ className, children, pxPerSecond = 25, pauseSeconds = 6 }: { className?: string; children: ReactNode; pxPerSecond?: number; pauseSeconds?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    let pos = 0;
    let waitUntil = Date.now() + pauseSeconds * 1000;
    let last = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const dt = (now - last) / 1000;
      last = now;
      const max = box.scrollHeight - box.clientHeight;
      if (max <= 1) pos = 0;
      else if (Date.now() >= waitUntil) {
        if (pos >= max) {
          pos = 0; // back to the top, then wait there
          waitUntil = Date.now() + pauseSeconds * 1000;
        } else {
          pos = Math.min(max, pos + pxPerSecond * dt);
          if (pos >= max) waitUntil = Date.now() + pauseSeconds * 1000;
        }
      }
      box.scrollTop = pos;
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [pxPerSecond, pauseSeconds]);
  return (
    <div ref={ref} className={`overflow-hidden ${className ?? ""}`}>
      {children}
    </div>
  );
}

const subscribeTicks = (cb: () => void) => {
  const id = setInterval(cb, 1_000);
  return () => clearInterval(id);
};

/** The time, large, with the weekday, date and week number under it (Copenhagen time). */
export function BoardClock() {
  const t = useTranslations("board");
  const locale = useLocale() === "da" ? "da-DK" : "en-GB";
  // Ten-second ticks from an external store: 0 on the server, so the clock only renders in the browser (no mismatch).
  const tick = useSyncExternalStore(subscribeTicks, () => Math.floor(Date.now() / 10_000), () => 0);
  if (!tick) return <div className="h-16" />;
  const now = new Date(tick * 10_000);
  const tz = appConfig.timezone;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const date = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(now);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return (
    <div className="text-right leading-tight">
      <div className="text-5xl font-semibold tabular-nums">{time}</div>
      <div className="text-lg text-muted-foreground first-letter:uppercase">
        {date} · {t("week", { week: isoWeek(day) })}
      </div>
    </div>
  );
}
