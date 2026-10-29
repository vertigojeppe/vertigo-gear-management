"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { applyLookedUpSpecs, lookUpSpecs } from "../actions";
import type { LookupPreview } from "../lookup";
import { pickable, pickKey } from "../specs";
import { SpecChangeTable } from "./spec-changes";

type Link = { label: string; url: string };

/**
 * Model page: paste the manufacturer's product page or datasheet, read what
 * was found (with the document's own words), tick what to keep, save.
 * Empty fields start ticked, values the model already has unticked.
 */
export function SpecLookup({ modelId, modelLabel, links }: { modelId: string; modelLabel: string; links: Link[] }) {
  const t = useTranslations("specLookup");
  const [found, lookAction] = useActionState<FormState<LookupPreview>, FormData>(lookUpSpecs, {});
  const [url, setUrl] = useState(links[0]?.url ?? "");
  const data = found.ok ? found.data : undefined;

  return (
    <section className="flex flex-col gap-3 rounded-md border p-3" data-testid="spec-lookup">
      <div>
        <h2 className="text-sm font-medium">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("help")}</p>
      </div>
      <ActionForm action={lookAction} className="flex flex-col gap-2">
        <input type="hidden" name="modelId" value={modelId} />
        {/* The link's own error goes up here too, so the button stays level with the input. */}
        <FormError message={found.error ?? found.fieldErrors?.url} />
        <div className="flex flex-wrap items-end gap-2">
          <Field id="lookup-url" label={t("url")} className="min-w-64 flex-1">
            <Input id="lookup-url" name="url" type="url" inputMode="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </Field>
          <SubmitButton variant="outline" pendingText={t("reading")}>
            {t("lookUp")}
          </SubmitButton>
        </div>
        {links.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {t("fromLinks")}
            {links.map((l) => (
              <button key={l.url} type="button" className="max-w-full truncate underline" onClick={() => setUrl(l.url)}>
                {l.label}
              </button>
            ))}
          </p>
        )}
      </ActionForm>
      {data && <LookupResult key={`${data.sources.map((s) => s.url).join("|")}:${JSON.stringify(data.row).length}`} data={data} modelLabel={modelLabel} />}
    </section>
  );
}

function LookupResult({ data, modelLabel }: { data: LookupPreview; modelLabel: string }) {
  const t = useTranslations("specLookup");
  const [saved, saveAction] = useActionState<FormState<{ fields: number; photo: boolean }>, FormData>(applyLookedUpSpecs, {});
  const [picked, setPicked] = useState<Set<string>>(() => new Set(data.plan.changes.filter((c) => c.action === "fill").map((c) => pickKey(data.modelId, c.field))));
  const toggle = (key: string, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  const useful = data.plan.changes.filter((c) => pickable(c.action));
  const from = (() => {
    try {
      return new URL(data.sources[0]?.url ?? "").hostname;
    } catch {
      return "a lookup";
    }
  })();

  if (saved.ok) {
    return (
      <p role="status" className="rounded-md border border-green-600/40 bg-green-50 p-3 text-sm dark:bg-green-950/30">
        {t("saved", { fields: saved.data?.fields ?? 0 })}
        {saved.data?.photo && ` ${t("photoSaved")}`}
      </p>
    );
  }
  return (
    <ActionForm action={saveAction} className="flex flex-col gap-3">
      <input type="hidden" name="modelId" value={data.modelId} />
      <input type="hidden" name="row" value={JSON.stringify(data.row)} />
      <input type="hidden" name="from" value={from} />
      <FormError message={saved.error} />
      {!data.matchesModel && (
        <p role="alert" className="rounded-md border border-amber-500/50 bg-amber-50 p-2 text-sm dark:bg-amber-950/30">
          {t("otherProduct", { product: data.product || "?" })}
        </p>
      )}
      {data.notes && <p className="text-sm text-muted-foreground">{data.notes}</p>}
      {data.plan.changes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("nothing")}</p>
      ) : (
        <SpecChangeTable modelId={data.modelId} modelLabel={modelLabel} changes={data.plan.changes} picked={picked} onToggle={toggle} evidence={data.evidence} />
      )}
      {data.images.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("photo")}</legend>
          <p className="text-xs text-muted-foreground">{data.hasPhoto ? t("photoReplaces") : t("photoHelp")}</p>
          <div className="flex flex-wrap gap-2">
            <label className="flex size-24 cursor-pointer items-center justify-center rounded-md border p-1 text-xs text-muted-foreground has-checked:ring-2 has-checked:ring-primary has-focus-visible:outline-2">
              <input type="radio" name="image" value="" defaultChecked className="sr-only" />
              {t("noPhoto")}
            </label>
            {data.images.map((src) => (
              <label key={src} className="size-24 cursor-pointer overflow-hidden rounded-md border bg-white p-1 has-checked:ring-2 has-checked:ring-primary has-focus-visible:outline-2">
                <input type="radio" name="image" value={src} className="sr-only" />
                {/* eslint-disable-next-line @next/next/no-img-element -- the manufacturer's picture, shown from their site until chosen */}
                <img src={src} alt={t("photoOption")} referrerPolicy="no-referrer" loading="lazy" className="size-full object-contain" onError={(e) => (e.currentTarget.closest("label")!.hidden = true)} />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="text-xs text-muted-foreground">
        {t("readFrom")}{" "}
        {data.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ", "}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline">
              {s.title}
            </a>
          </span>
        ))}{" "}
        · {data.extractor}
      </p>
      <p className="text-xs text-muted-foreground">{t("check")}</p>
      <div>
        <SubmitButton pendingText={t("saving")}>{useful.length === 0 || picked.size === 0 ? t("markChecked") : t("save", { fields: picked.size })}</SubmitButton>
      </div>
    </ActionForm>
  );
}
