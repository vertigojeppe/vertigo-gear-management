"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/format";

type Saved = { url: string; title: string; savedAt: number };

/**
 * The packing lists the service worker kept for offline reading. Read from
 * the worker's index (served from the cache, so it works with no network).
 */
export function SavedLists() {
  const t = useTranslations("pwa");
  const [lists, setLists] = useState<Saved[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/__offline-index", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Saved[]) => {
        if (!cancelled) setLists(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setLists([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!lists || lists.length === 0) return null;
  return (
    <section className="mt-4 w-full text-left">
      <h2 className="text-sm font-medium">{t("savedLists")}</h2>
      <p className="text-xs text-muted-foreground">{t("savedListsHelp")}</p>
      <ul className="mt-2 divide-y rounded-md border text-sm">
        {lists.map((l) => (
          <li key={l.url}>
            <a href={l.url} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/50">
              <span className="min-w-0 flex-1 truncate">{l.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(new Date(l.savedAt))}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
