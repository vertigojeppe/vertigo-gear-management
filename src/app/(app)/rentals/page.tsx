import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/form/native-select";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusPill } from "@/components/status-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can, requireActor } from "@/lib/auth/session";
import { formatDate, formatMoney } from "@/lib/format";
import { listRentals, rentalFilters } from "@/modules/rentals";
import { RENTAL_STATUSES } from "../../../../config/app.config";

export const metadata: Metadata = { title: "Rentals" };

export default async function RentalsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const sp = await props.searchParams;
  const filters = rentalFilters.parse(sp);
  const t = await getTranslations("rentals");
  const ts = await getTranslations("rentalStatus");
  const tc = await getTranslations("common");
  const result = await listRentals(filters);
  const canEdit = can(actor.role, "rentals.write");
  const hasFilters = Boolean(filters.q || filters.status);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("title")}
        actions={
          canEdit && (
            <Link href="/rentals/new" className={buttonVariants()}>
              {t("newRental")}
            </Link>
          )
        }
      />
      <form method="get" className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <Input name="q" defaultValue={filters.q ?? ""} placeholder={tc("search")} aria-label={tc("search")} />
        <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label={t("status")} className="sm:w-40">
          <option value="">{t("allStatuses")}</option>
          {RENTAL_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {ts(s.key)}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          {tc("filter")}
        </Button>
        {hasFilters && (
          <Link href="/rentals" className={buttonVariants({ variant: "ghost" })}>
            {tc("clear")}
          </Link>
        )}
      </form>
      {result.total === 0 ? (
        <EmptyState
          title={t("noRentals")}
          body={t("noRentalsBody")}
          action={
            canEdit &&
            !hasFilters && (
              <Link href="/rentals/new" className={buttonVariants()}>
                {t("newRental")}
              </Link>
            )
          }
        />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {result.rows.map((r) => (
            <li key={r.id}>
              <Link href={`/rentals/${r.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <span className="w-36 shrink-0 text-xs text-muted-foreground">
                  {formatDate(r.startDate)} – {formatDate(r.endDate)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.clientName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.lineCount} {t("lines").toLowerCase()} · {formatMoney(r.total)}
                  </span>
                </span>
                <StatusPill color={RENTAL_STATUSES.find((s) => s.key === r.effectiveStatus)?.color ?? "gray"}>{ts(r.effectiveStatus)}</StatusPill>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={result.page} pages={result.pages} total={result.total} params={sp} />
    </div>
  );
}
