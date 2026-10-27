"use client";

import { ColorBar, ColorDot } from "@/components/color-marks";
import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/form/native-select";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addKitLine, addLine, addTemplateLine } from "../actions";
import { groupCatalog, searchCatalog, type CatalogEntry } from "../picker";
import { makersOf } from "@/lib/format";
import { buildGlossary } from "@/lib/search";

type Target = { kind: "list"; projectId: string; listId: string } | { kind: "template"; templateId: string };
type Option = { id: string; label: string };
type RowState = { type: "pending" } | { type: "added"; count: number } | { type: "error"; message: string };
/** What this picker added on top of the catalog's `onList` it saw then (`base`). */
type Added = { base: number; n: number };

/**
 * Type-to-add: one search box over every model and kit. Matches are shown
 * by family ("16 mm rustfri rods") with one row per variant ("50 cm",
 * "70 cm"), each with stock, "already on the list", a quantity and an Add
 * button. Enter adds the highlighted row and keeps the focus, so a list is
 * built from the keyboard (or a barcode scanner typing a tag + Enter).
 */
export function GearPicker({ target, catalog, cases = [], glossaryGroups = [] }: { target: Target; catalog: CatalogEntry[]; cases?: Option[]; glossaryGroups?: string[][] }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [caseId, setCaseId] = useState("");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [added, setAdded] = useState<Record<string, Added>>({});
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const glossary = useMemo(() => buildGlossary(glossaryGroups), [glossaryGroups]);
  const { results, close } = useMemo(() => searchCatalog(catalog, query, 60, glossary), [catalog, query, glossary]);
  const groups = useMemo(() => groupCatalog(results), [results]);
  // The flat order (for arrow keys / Enter) follows the grouped display.
  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  // A new query highlights the first match again (state derived during render, no effect).
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setActive(0);
  }

  const quantityOf = (e: CatalogEntry) => Math.max(1, Math.round(Number(qty[e.id] ?? "1")) || 1);
  // The page refreshes after each add; once the catalog counts the new lines (onList moved), the local count is dropped.
  const onListNow = (e: CatalogEntry) => e.onList + (added[e.id]?.base === e.onList ? added[e.id].n : 0);

  const add = (e: CatalogEntry) => {
    if (rows[e.id]?.type === "pending") return;
    if (e.kind === "kit" && onListNow(e) > 0) return;
    const fd = new FormData();
    const n = e.kind === "kit" ? 1 : quantityOf(e);
    if (target.kind === "list") {
      fd.set("projectId", target.projectId);
      fd.set("listId", target.listId);
      if (e.kind === "kit") fd.set("kitItemId", e.id);
      else {
        fd.set("modelId", e.id);
        fd.set("quantity", String(n));
        if (caseId) fd.set("caseItemId", caseId);
      }
    } else {
      fd.set("templateId", target.templateId);
      fd.set("modelId", e.id);
      fd.set("quantity", String(n));
    }
    setRows((r) => ({ ...r, [e.id]: { type: "pending" } }));
    startTransition(async () => {
      const result = target.kind === "template" ? await addTemplateLine({}, fd) : e.kind === "kit" ? await addKitLine({}, fd) : await addLine({}, fd);
      if (result.ok) {
        setAdded((a) => {
          const cur = a[e.id];
          return { ...a, [e.id]: cur?.base === e.onList ? { base: cur.base, n: cur.n + n } : { base: e.onList, n } };
        });
        setRows((r) => ({ ...r, [e.id]: { type: "added", count: n } }));
      } else {
        setRows((r) => ({ ...r, [e.id]: { type: "error", message: result.error ?? Object.values(result.fieldErrors ?? {})[0] ?? tc("error") } }));
      }
      inputRef.current?.focus();
    });
  };

  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (flat[active]) add(flat[active]);
    } else if (ev.key === "Escape") {
      setQuery("");
    }
  };

  let index = -1;
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium">
          {t("searchGear")}
          <Input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} placeholder={t("searchGearPlaceholder")} autoComplete="off" spellCheck={false} autoFocus />
        </label>
        {cases.length > 0 && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("addIntoCase")}
            <NativeSelect value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-48">
              <option value="">{t("noCase")}</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
      </div>
      {query.trim() === "" ? (
        <p className="text-xs text-muted-foreground">{t("searchHint", { count: catalog.length })}</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noMatches", { query: query.trim() })}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {close && <p className="text-xs text-muted-foreground">{t("closeMatches", { query: query.trim() })}</p>}
          {groups.map((g) => (
            <section key={g.key} className="rounded-md border">
              <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-sm">
                <ColorBar color={g.entries[0]?.color} className="h-4" />
                <span className="font-medium">{g.family}</span>
                {makersOf(g.entries) && <span className="text-xs text-muted-foreground">{makersOf(g.entries)}</span>}
                {g.kind === "kit" && (
                  <StatusPill color="purple">
                    {t("kit")}
                  </StatusPill>
                )}
                <span className="text-xs text-muted-foreground">{g.category}</span>
                {g.entries.length > 1 && <span className="text-xs text-muted-foreground">· {t("variantCount", { count: g.entries.length })}</span>}
              </header>
              <ul className="divide-y text-sm" role="list">
                {g.entries.map((e) => {
                  index++;
                  const i = index;
                  const state = rows[e.id];
                  const n = quantityOf(e);
                  const short = e.kind === "model" && n + onListNow(e) > e.inHouse;
                  const kitTaken = e.kind === "kit" && onListNow(e) > 0;
                  return (
                    <li key={`${e.kind}:${e.id}`} className={`flex flex-col gap-1 px-3 py-1.5 sm:flex-row sm:items-center sm:gap-3 ${i === active ? "bg-muted/60" : ""}`} onMouseEnter={() => setActive(i)}>
                      <span className="min-w-0 flex-1">
                        <ColorDot color={e.lengthColor} className="mr-1.5" />
                        <span className={e.variant ? "font-medium" : "text-muted-foreground"}>{e.variant ?? (g.entries.length > 1 ? "—" : e.label)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {e.kind === "model" ? t("inHouseOf", { inHouse: e.inHouse, owned: e.owned }) : e.category}
                          {onListNow(e) > 0 ? ` · ${t("onList", { count: onListNow(e) })}` : ""}
                        </span>
                        {state?.type === "error" && <span className="block text-xs text-destructive">{state.message}</span>}
                      </span>
                      {e.kind === "model" && (
                        <Input type="number" min="1" step="1" value={qty[e.id] ?? "1"} onChange={(ev) => setQty((q) => ({ ...q, [e.id]: ev.target.value }))} onKeyDown={(ev) => ev.key === "Enter" && (ev.preventDefault(), add(e))} aria-label={`${t("quantity")} ${e.label}`} className={`h-8 w-20 ${short ? "border-amber-500" : ""}`} />
                      )}
                      <Button size="sm" variant={state?.type === "added" ? "outline" : "default"} disabled={state?.type === "pending" || kitTaken} onClick={() => add(e)} aria-label={`${tc("add")} ${e.label}`}>
                        {state?.type === "pending" ? tc("loading") : kitTaken ? t("kitOnList") : state?.type === "added" ? `✓ ${t("added")}` : tc("add")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
