import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActivityList } from "@/components/activity-list";
import { CustomFieldValuesList } from "@/components/form/custom-field-inputs";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { can, requireActor } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { modelOptions } from "@/modules/inventory";
import { rateTableOptions } from "@/modules/pricing";
import { QuoteSection } from "@/modules/pricing/components/quote-section";
import { assignableUnits, rentalDetail } from "@/modules/rentals";
import { AssignUnitForm, RemoveLineButton, RentalLineDialog } from "@/modules/rentals/components/rental-line-dialog";
import { DeleteRentalButton, RentalStatusButtons } from "@/modules/rentals/components/rental-buttons";
import { customFieldDefinitions } from "@/modules/settings";
import { RENTAL_STATUSES, appConfig } from "../../../../../config/app.config";

export const metadata: Metadata = { title: "Rental" };

export default async function RentalPage(props: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await props.params;
  const [detail, defs, models, tables] = await Promise.all([rentalDetail(id), customFieldDefinitions.forEntity("rental"), modelOptions(), rateTableOptions()]);
  if (!detail) notFound();
  const { rental, client, lines, quote } = detail;
  const t = await getTranslations("rentals");
  const ts = await getTranslations("rentalStatus");
  const tc = await getTranslations("common");
  const tp = await getTranslations("projects");
  const canEdit = can(actor.role, "rentals.write") && rental.status !== "returned";
  const isAdmin = can(actor.role, "users.manage");
  const units = canEdit ? Object.fromEntries(await Promise.all(lines.filter((l) => l.trackingType === "serialized").map(async (l) => [l.id, await assignableUnits(l.modelId, id)] as const))) : {};
  const gearTotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {client.name}
            <StatusPill color={RENTAL_STATUSES.find((s) => s.key === rental.effectiveStatus)?.color ?? "gray"} className="text-sm">
              {ts(rental.effectiveStatus)}
            </StatusPill>
          </span>
        }
        subtitle={`${formatDate(rental.startDate)} – ${formatDate(rental.endDate)} · ${t("days", { count: quote.windowDays ?? quote.chargeDays })}${rental.outAt ? ` · ${t("outAt", { date: formatDateTime(rental.outAt) })}` : ""}${rental.returnedAt ? ` · ${t("returnedAt", { date: formatDateTime(rental.returnedAt) })}` : ""}`}
        crumbs={[{ label: t("title"), href: "/rentals" }, { label: client.name }]}
        actions={
          <>
            <a href={`/api/rentals/${rental.id}/agreement.pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("agreement")}
            </a>
            {can(actor.role, "rentals.write") && <RentalStatusButtons rentalId={rental.id} status={rental.status} />}
            {canEdit && (
              <Link href={`/rentals/${rental.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {tc("edit")}
              </Link>
            )}
            {isAdmin && rental.status !== "out" && <DeleteRentalButton rentalId={rental.id} />}
          </>
        }
      />

      <div className="grid gap-6 text-sm md:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium">{t("client")}</h2>
          <p>{[client.contactName, client.phone, client.email, client.address].filter(Boolean).join(" · ") || "—"}</p>
          {rental.deposit !== null && (
            <p className="text-muted-foreground">
              {t("deposit", { currency: "" }).replace(" ()", "")}: {formatMoney(rental.deposit)}
            </p>
          )}
        </div>
        <div>
          <CustomFieldValuesList defs={defs} values={rental.customFields} />
          {rental.notes && <p className="whitespace-pre-line text-muted-foreground">{rental.notes}</p>}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">
            {t("lines")} <span className="text-sm font-normal text-muted-foreground">({lines.length})</span>
          </h2>
          {canEdit && <RentalLineDialog rentalId={rental.id} models={models} />}
          {rental.status === "returned" && <span className="text-sm text-muted-foreground">{t("finished")}</span>}
        </div>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noLines")}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("model")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("quantity")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("pricePerDay", { currency: appConfig.currency })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("lineDiscount")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("lineTotal")}</th>
                  <th className="px-3 py-2 font-medium">{t("unit")}</th>
                  {canEdit && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      <Link href={`/inventory/models/${l.modelId}`} className="hover:underline">
                        {l.modelLabel}
                      </Link>
                      {l.note && <span className="block text-xs text-muted-foreground">{l.note}</span>}
                      {l.shortfall > 0 && (
                        <StatusPill color="red" className="mt-1" title={l.conflicts.join(", ")}>
                          {tp("overbooked")} · {tp("shortfall", { count: l.shortfall })}
                        </StatusPill>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{l.quantity}</td>
                    <td className="px-3 py-2 text-right">{l.pricePerDay !== null ? formatMoney(l.pricePerDay) : "–"}</td>
                    <td className="px-3 py-2 text-right">{l.discountPct ? `${l.discountPct}%` : ""}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(l.lineTotal)}</td>
                    <td className="px-3 py-2">
                      {l.trackingType === "serialized" ? (
                        canEdit ? (
                          <AssignUnitForm rentalId={rental.id} lineId={l.id} current={l.itemId} units={units[l.id] ?? []} />
                        ) : l.itemTag ? (
                          <Link href={`/inventory/items/${l.itemId}`} className="font-mono text-xs hover:underline">
                            {l.itemTag}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("noUnit")}</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1">
                          <RentalLineDialog rentalId={rental.id} models={models} existing={{ id: l.id, modelId: l.modelId, quantity: l.quantity, pricePerDay: l.pricePerDay, discountPct: l.discountPct, note: l.note }} />
                          <RemoveLineButton id={l.id} rentalId={rental.id} />
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr>
                  <td colSpan={4} className="px-3 py-1 text-right text-muted-foreground">
                    {t("subtotal")}
                  </td>
                  <td className="px-3 py-1 text-right">{formatMoney(gearTotal)}</td>
                  <td colSpan={canEdit ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {canEdit && <p className="text-xs text-muted-foreground">{t("assignHelp")}</p>}
      </section>

      <QuoteSection quote={quote} tables={tables} canEdit={canEdit} showGear={false} pdfHref={`/api/rentals/${rental.id}/agreement.pdf`} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{tc("activity")}</h2>
        <ActivityList rows={detail.activity} />
      </section>
    </div>
  );
}
