import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { can, requireActor } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { ModelName } from "@/components/model-name";
import { categoryOptions } from "@/modules/inventory";
import { InventoryTabs } from "@/modules/inventory/components/inventory-tabs";
import { wishCounts, wishList, type WishStatus } from "@/modules/wishlist";
import { DeleteWishButton, WishDialog, WishStatusButton } from "@/modules/wishlist/components/wish-forms";
import { cn } from "cn";

export const metadata: Metadata = { title: "Wish list" };

export default async function WishListPage(props: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requireActor();
  const { status: raw } = await props.searchParams;
  const status: WishStatus = raw === "bought" ? "bought" : "open";
  const t = await getTranslations("wishlist");
  const ti = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const [rows, counts, categories] = await Promise.all([wishList(status), wishCounts(), categoryOptions()]);
  const canEdit = can(actor.role, "inventory.write");

  const filter = (key: WishStatus, count: number) => (
    <Link
      href={key === "open" ? "/inventory/wishlist" : `/inventory/wishlist?status=${key}`}
      className={cn("rounded-full border px-3 py-1 text-sm", status === key ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50")}
      aria-current={status === key ? "page" : undefined}
    >
      {t(key)} · {count}
    </Link>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={ti("title")}
        actions={
          <>
            <a href="/api/export/wishes.csv" className={buttonVariants({ variant: "outline" })}>
              {tc("exportCsv")}
            </a>
            {canEdit && <WishDialog trigger="new" categories={categories} />}
          </>
        }
      />
      <InventoryTabs />
      <div className="flex flex-wrap items-center gap-2">
        {filter("open", counts.open)}
        {filter("bought", counts.bought)}
        <p className="ml-2 text-sm text-muted-foreground">{t("help")}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={status === "open" ? t("noWishes") : t("noBought")} body={status === "open" ? t("noWishesBody") : undefined} action={canEdit && status === "open" && <WishDialog trigger="new" categories={categories} />} />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((w) => (
            <li key={w.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {w.quantity > 1 ? `${w.quantity} × ` : ""}
                  <ModelName model={w} />
                  {w.categoryName ? <span className="font-normal text-muted-foreground"> · {w.categoryName}</span> : null}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {[
                    w.price !== null ? `${t("price")} ${formatMoney(w.price)}` : null,
                    w.rentalDayPrice !== null ? `${t("rentalDayPrice")} ${formatMoney(w.rentalDayPrice)}` : null,
                    w.createdByName ? t("addedBy", { name: w.createdByName }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {w.link && (
                    <>
                      {" · "}
                      <a href={w.link} target="_blank" rel="noreferrer" className="underline">
                        {t("openLink")}
                      </a>
                    </>
                  )}
                </span>
                {w.notes && <span className="block whitespace-pre-line text-xs text-muted-foreground">{w.notes}</span>}
                {w.modelId && (
                  <span className="block text-xs">
                    {t("becameModel")}{" "}
                    <Link href={`/inventory/models/${w.modelId}`} className="underline">
                      {w.modelLabel}
                    </Link>
                  </span>
                )}
              </span>
              {canEdit && (
                <span className="flex shrink-0 flex-wrap items-center gap-1">
                  {w.status === "open" && (
                    <Link href={`/inventory/models/new?wish=${w.id}`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                      {t("convert")}
                    </Link>
                  )}
                  <WishStatusButton id={w.id} status={w.status} />
                  <WishDialog trigger="edit" wish={w} categories={categories} />
                  <DeleteWishButton id={w.id} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
