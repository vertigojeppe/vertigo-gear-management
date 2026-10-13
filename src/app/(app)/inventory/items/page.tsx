import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/form/native-select";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can, requireActor } from "@/lib/auth/session";
import { InventoryTabs, categoryOptions, itemFilters, listItems, locationOptions, modelOptions } from "@/modules/inventory";
import { customFieldDefinitions } from "@/modules/settings";
import { ITEM_STATUSES } from "../../../../../config/app.config";
import { modelLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Items" };

export default async function ItemsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const sp = await props.searchParams;
  const filters = itemFilters.parse(sp);
  const t = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const ts = await getTranslations("itemStatus");
  const defs = await customFieldDefinitions.forEntity("item");
  const cfKey = defs.find((d) => sp[`cf.${d.key}`])?.key;
  const customField = cfKey ? { key: cfKey, value: sp[`cf.${cfKey}`]! } : undefined;
  const [result, cats, locs, models] = await Promise.all([listItems({ ...filters, customField }), categoryOptions(), locationOptions(), modelOptions()]);
  const canEdit = can(actor.role, "inventory.write");
  const hasFilters = Boolean(filters.q || filters.status || filters.locationId || filters.categoryId || filters.modelId || filters.kits || customField);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <a href={`/api/export/items.csv${(() => { const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v !== undefined && k !== "page") as [string, string][]).toString(); return q ? `?${q}` : ""; })()}`} className={buttonVariants({ variant: "outline" })}>
              {tc("exportCsv")}
            </a>
            {canEdit && (
              <Link href="/inventory/items/new" className={buttonVariants()}>
                {t("newItem")}
              </Link>
            )}
          </>
        }
      />
      <InventoryTabs />

      <form method="get" className="flex flex-col gap-2">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Input name="q" defaultValue={filters.q ?? ""} placeholder={`${tc("search")}: ${t("assetTag")}, ${t("serialNumber")}, ${t("model")}`} aria-label={tc("search")} />
          <Button type="submit" variant="outline">
            {tc("filter")}
          </Button>
          {hasFilters && (
            <Link href="/inventory/items" className={buttonVariants({ variant: "ghost" })}>
              {tc("clear")}
            </Link>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label={t("status")}>
            <option value="">{t("allStatuses")}</option>
            {ITEM_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {ts(s.key)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="categoryId" defaultValue={filters.categoryId ?? ""} aria-label={t("category")}>
            <option value="">{t("allCategories")}</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {"  ".repeat(c.depth)}
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="locationId" defaultValue={filters.locationId ?? ""} aria-label={t("location")}>
            <option value="">{t("allLocations")}</option>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {"  ".repeat(l.depth)}
                {l.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="modelId" defaultValue={filters.modelId ?? ""} aria-label={t("model")}>
            <option value="">{t("allModels")}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {modelLabel(m)}
              </option>
            ))}
          </NativeSelect>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="kits" value="1" defaultChecked={filters.kits} className="size-4" />
            {t("kitsOnly")}
          </label>
        </div>
        {defs.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-5">
            {defs.map((d) => (
              <Input key={d.key} name={`cf.${d.key}`} defaultValue={sp[`cf.${d.key}`] ?? ""} placeholder={d.label} aria-label={d.label} />
            ))}
          </div>
        )}
      </form>

      {result.total === 0 ? (
        <EmptyState title={t("noItems")} body={t("noItemsBody")} />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {result.rows.map((i) => (
            <li key={i.id}>
              <Link href={`/inventory/items/${i.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <span className="w-16 shrink-0 font-mono text-xs">{i.assetTag}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {i.isKit && <span className="mr-1 rounded bg-muted px-1 text-[10px] uppercase">{t("kit")}</span>}
                    {i.name ? `${i.name} · ` : ""}
                    {modelLabel(i.model)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {i.model.trackingType === "bulk" ? `×${i.quantity}` : i.serialNumber ? `SN ${i.serialNumber}` : t("noSerial")}
                    {" · "}
                    {i.locationName ?? t("noLocation")}
                    {i.parentLabel ? ` · ${t("inKit")}: ${i.parentLabel}` : ""}
                  </span>
                </span>
                <StatusBadge status={i.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={result.page} pages={result.pages} total={result.total} params={sp} />
    </div>
  );
}
