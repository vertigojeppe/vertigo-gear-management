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
import { InventoryTabs, categoryOptions, listModels, modelFilters, TRACKING_TYPES } from "@/modules/inventory";

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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("title")}
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
              {"  ".repeat(c.depth)}
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
          {result.rows.map((m) => (
            <li key={m.id}>
              <Link href={`/inventory/models/${m.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
                  {m.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <Package className="size-5" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.manufacturer} {m.name}
                    {m.archived && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{t("archived")}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.categoryPath.join(" › ")} · {t(m.trackingType)}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p>
                    <span className="font-medium">{m.inHouse}</span>
                    <span className="text-muted-foreground"> / {m.owned}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{t("inHouse")}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={result.page} pages={result.pages} total={result.total} params={sp} />
    </div>
  );
}
