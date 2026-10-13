import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/form/native-select";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can, requireActor } from "@/lib/auth/session";
import { FamilyList, InventoryTabs, categoryOptions, listModels, modelFilters, TRACKING_TYPES } from "@/modules/inventory";

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
  // The current filters, so a bulk action can come back to the same view; "done" is the outcome of the last one.
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v !== undefined && k !== "done") as [string, string][]).toString();
  const done = sp.done?.match(/^(archive|unarchive|delete):(\d+)$/);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("title")}
        subtitle={result.total > 0 ? t("familiesCount", { families: result.total, models: result.models }) : undefined}
        actions={
          <>
            <a href={`/api/export/models.csv${(() => { const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v !== undefined && k !== "page") as [string, string][]).toString(); return q ? `?${q}` : ""; })()}`} className={buttonVariants({ variant: "outline" })}>
              {tc("exportCsv")}
            </a>
            {canEdit && (
              <Link href="/inventory/models/new" className={buttonVariants()}>
                {t("newModel")}
              </Link>
            )}
          </>
        }
      />
      <InventoryTabs />
      {done && (
        <p role="status" className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          {t("bulkDone", { op: done[1], done: Number(done[2]) })}
        </p>
      )}

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
        <FamilyList families={result.families} canEdit={canEdit} isAdmin={can(actor.role, "users.manage")} returnTo={`/inventory${query ? `?${query}` : ""}`} />
      )}
      <Pagination page={result.page} pages={result.pages} total={result.total} params={sp} />
    </div>
  );
}

