import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/form/native-select";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can, requireActor } from "@/lib/auth/session";
import { familyLabel, modelLabel } from "@/lib/format";
import { InventoryTabs, categoryOptions, listModels, modelFilters, TRACKING_TYPES, type ModelFamily, type ModelListRow } from "@/modules/inventory";

export const metadata: Metadata = { title: "Inventory" };

export default async function ModelsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const sp = await props.searchParams;
  const filters = modelFilters.parse(sp);
  const t = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const [result, cats] = await Promise.all([listModels(filters), categoryOptions()]);
  const canEdit = can(actor.role, "inventory.write");
  const hasFilters = Boolean(filters.q || filters.categoryId || filters.trackingType || filters.archived);
  const tracking = (f: ModelFamily) => (f.trackingType === "mixed" ? `${t("serialized")} + ${t("bulk")}` : t(f.trackingType));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("title")}
        subtitle={result.total > 0 ? t("familiesCount", { families: result.total, models: result.models }) : undefined}
        actions={
          canEdit && (
            <Link href="/inventory/models/new" className={buttonVariants()}>
              {t("newModel")}
            </Link>
          )
        }
      />
      <InventoryTabs />

      <form method="get" className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
        <Input name="q" defaultValue={filters.q ?? ""} placeholder={tc("search")} aria-label={tc("search")} />
        <NativeSelect name="categoryId" defaultValue={filters.categoryId ?? ""} aria-label={t("category")} className="sm:w-48">
          <option value="">{t("allCategories")}</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {"  ".repeat(c.depth)}
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="trackingType" defaultValue={filters.trackingType ?? ""} aria-label={t("trackingType")} className="sm:w-36">
          <option value="">{tc("all")}</option>
          {TRACKING_TYPES.map((tt) => (
            <option key={tt} value={tt}>
              {t(tt)}
            </option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={filters.archived} className="size-4" />
          {t("showArchived")}
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            {tc("filter")}
          </Button>
          {hasFilters && (
            <Link href="/inventory" className={buttonVariants({ variant: "ghost" })}>
              {tc("clear")}
            </Link>
          )}
        </div>
      </form>

      {result.total === 0 ? (
        <EmptyState
          title={hasFilters ? t("noItems") : t("noModels")}
          body={hasFilters ? t("noItemsBody") : t("noModelsBody")}
          action={
            canEdit &&
            !hasFilters && (
              <Link href="/inventory/models/new" className={buttonVariants()}>
                {t("newModel")}
              </Link>
            )
          }
        />
      ) : (
        <ul className="divide-y rounded-md border">
          {result.families.map((f) =>
            f.variants.length === 1 ? (
              <li key={f.key}>
                <ModelRow m={f.variants[0]} label={modelLabel(f.variants[0])} sub={`${f.categoryPath.join(" › ")} · ${t(f.variants[0].trackingType)}`} archivedLabel={t("archived")} inHouseLabel={t("inHouse")} />
              </li>
            ) : (
              <li key={f.key}>
                {/* A family: the summary row carries the totals, the variants open underneath (no JavaScript needed). */}
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                    <Thumb url={f.thumbUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {familyLabel(f)}
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{t("variantCount", { count: f.variants.length })}</span>
                        {f.archived && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{t("archived")}</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.categoryPath.join(" › ")} · {tracking(f)} · {f.variants.map((v) => v.variant ?? "—").join(", ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p>
                        <span className="font-medium">{f.inHouse}</span>
                        <span className="text-muted-foreground"> / {f.owned}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{t("inHouse")}</p>
                    </div>
                    <span className="text-muted-foreground transition-transform group-open:rotate-90" aria-hidden>
                      ›
                    </span>
                  </summary>
                  <ul className="divide-y border-t bg-muted/20">
                    {f.variants.map((v) => (
                      <li key={v.id} className="pl-10">
                        <ModelRow m={v} label={v.variant ?? modelLabel(v)} sub={v.trackingType !== f.trackingType ? t(v.trackingType) : ""} archivedLabel={t("archived")} inHouseLabel={t("inHouse")} compact />
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ),
          )}
        </ul>
      )}
      <Pagination page={result.page} pages={result.pages} total={result.total} params={sp} />
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <Package className="size-5" aria-hidden />
      )}
    </div>
  );
}

function ModelRow({ m, label, sub, archivedLabel, inHouseLabel, compact = false }: { m: ModelListRow; label: string; sub: string; archivedLabel: string; inHouseLabel: string; compact?: boolean }) {
  return (
    <Link href={`/inventory/models/${m.id}`} className={`flex items-center gap-3 px-3 hover:bg-muted/50 ${compact ? "py-1.5" : "py-2"}`}>
      {!compact && <Thumb url={m.thumbUrl} />}
      <div className="min-w-0 flex-1">
        <p className={`truncate ${compact ? "" : "font-medium"}`}>
          {label}
          {m.archived && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{archivedLabel}</span>}
        </p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="shrink-0 text-right text-sm">
        <p>
          <span className="font-medium">{m.inHouse}</span>
          <span className="text-muted-foreground"> / {m.owned}</span>
        </p>
        {!compact && <p className="text-xs text-muted-foreground">{inHouseLabel}</p>}
      </div>
    </Link>
  );
}
