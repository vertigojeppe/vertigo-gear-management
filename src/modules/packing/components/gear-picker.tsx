"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/form/native-select";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addKitLine, addLine, addTemplateLine } from "../actions";
import { filterCatalog, type CatalogEntry } from "../picker";

type Target = { kind: "list"; projectId: string; listId: string } | { kind: "template"; templateId: string };
type Option = { id: string; label: string };
type RowState = { type: "pending" } | { type: "added"; count: number } | { type: "error"; message: string };

/**
 * Type-to-add: one search box over every model and kit, results with
 * stock and "already on the list", a quantity per row and an Add button.
 * Enter adds the highlighted row, so a list can be built without leaving
 * the keyboard (or a barcode scanner, which types the tag and Enter).
 */
export function GearPicker({ target, catalog, cases = [] }: { target: Target; catalog: CatalogEntry[]; cases?: Option[] }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [caseId, setCaseId] = useState("");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [added, setAdded] = useState<Record<string, number>>({});
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => filterCatalog(catalog, query), [catalog, query]);
  // A new query highlights the first match again (state derived during render, no effect).
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setActive(0);
  }

  const quantityOf = (e: CatalogEntry) => Math.max(1, Math.round(Number(qty[e.id] ?? "1")) || 1);
  const onListNow = (e: CatalogEntry) => e.onList + (added[e.id] ?? 0);

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
        setAdded((a) => ({ ...a, [e.id]: (a[e.id] ?? 0) + n }));
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
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (results[active]) add(results[active]);
    } else if (ev.key === "Escape") {
      setQuery("");
    }
  };

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
        <ul className="divide-y rounded-md border text-sm" role="list">
          {results.map((e, i) => {
            const state = rows[e.id];
            const n = quantityOf(e);
            const short = e.kind === "model" && n + onListNow(e) > e.inHouse;
            const kitTaken = e.kind === "kit" && onListNow(e) > 0;
            return (
              <li key={`${e.kind}:${e.id}`} className={`flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 ${i === active ? "bg-muted/60" : ""}`} onMouseEnter={() => setActive(i)}>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{e.label}</span>
                  {e.kind === "kit" && (
                    <StatusPill color="purple" className="ml-2">
                      {t("kit")}
                    </StatusPill>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {e.category}
                    {e.kind === "model" ? ` · ${t("inHouseOf", { inHouse: e.inHouse, owned: e.owned })}` : ""}
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
      )}
    </div>
  );
}
