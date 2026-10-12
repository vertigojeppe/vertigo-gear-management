import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type { Quote } from "../queries";
import { ExtraLineDialog, QuoteSettingsDialog, RemoveExtraLineButton } from "./quote-dialogs";

type TableOption = { id: string; name: string; isDefault: boolean };

/**
 * The priced part of a project or rental page: rate table, charge days
 * and discount, the gear lines (optional: the rental page has its own
 * table with unit assignment), extra lines, totals and the PDF link.
 */
export async function QuoteSection({ quote, tables, canEdit, showGear, pdfHref }: { quote: Quote; tables: TableOption[]; canEdit: boolean; showGear: boolean; pdfHref: string }) {
  const t = await getTranslations("pricing");
  const tc = await getTranslations("common");
  const holder = { kind: quote.holder.kind, id: quote.holder.id };
  const { totals } = quote;
  const cols = 5;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{t("quote")}</h2>
        <span className="flex flex-wrap items-center gap-2">
          <a href={pdfHref} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {quote.holder.kind === "rental" ? t("agreementPdf") : t("quotePdf")}
          </a>
          {canEdit && <QuoteSettingsDialog holder={holder} tables={tables} current={{ rateTableId: quote.rateTableOverridden ? (quote.rateTable?.id ?? null) : null, chargeDays: quote.chargeDaysOverridden ? quote.chargeDays : null, discountPct: quote.discountPct, terms: quote.terms }} windowDays={quote.windowDays} />}
          {canEdit && <ExtraLineDialog holder={holder} />}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {quote.rateTable ? (
          <>
            {t("rateTable")}: <Link href={`/settings/pricing/${quote.rateTable.id}`} className="hover:underline">{quote.rateTable.name}</Link>
            {quote.rateTableOverridden ? "" : ` (${t("default")})`} · {t("chargeDaysValue", { days: quote.chargeDays })}
            {quote.chargeDaysOverridden && quote.windowDays && quote.windowDays !== quote.chargeDays ? ` (${t("windowDays", { days: quote.windowDays })})` : ""} · {t("factorValue", { factor: totals.factor })}
            {quote.discountPct ? ` · ${t("documentDiscount")} ${quote.discountPct}%` : ""}
          </>
        ) : (
          <>
            {t("noRateTable")}{" "}
            <Link href="/settings/pricing" className="underline">
              {t("title")}
            </Link>
          </>
        )}
      </p>

      {(showGear && quote.gearLines.length > 0) || quote.extraLines.length > 0 || totals.subtotal > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t("line")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("quantity")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("unitPriceShort")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("discountShort")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("lineTotal")}</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {showGear &&
                quote.gearLines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      <Link href={`/inventory/models/${l.modelId}`} className="hover:underline">
                        {l.label}
                      </Link>
                      {l.itemTag && <span className="ml-1 font-mono text-xs text-muted-foreground">{l.itemTag}</span>}
                      {l.dayPrice === null && <span className="ml-1 text-xs text-amber-700 dark:text-amber-300">{t("noDayPrice")}</span>}
                      <span className="block text-xs text-muted-foreground">{t("gearLineMath", { price: formatMoney(l.dayPrice ?? 0), factor: totals.factor, quantity: l.quantity })}</span>
                    </td>
                    <td className="px-3 py-2 text-right">{l.quantity}</td>
                    <td className="px-3 py-2 text-right">{l.dayPrice !== null ? formatMoney(l.dayPrice) : "–"}</td>
                    <td className="px-3 py-2 text-right">{l.discountPct ? `${l.discountPct}%` : ""}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(l.net)}</td>
                    {canEdit && <td className="px-3 py-2" />}
                  </tr>
                ))}
              {quote.extraLines.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2">{l.description}</td>
                  <td className="px-3 py-2 text-right">{l.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(l.unitPrice)}</td>
                  <td className="px-3 py-2 text-right">{l.discountPct ? `${l.discountPct}%` : ""}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(l.net)}</td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1">
                        <ExtraLineDialog holder={holder} existing={{ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct }} />
                        <RemoveExtraLineButton holder={holder} id={l.id} />
                      </span>
                    </td>
                  )}
                </tr>
              ))}
              {!showGear && quote.gearLines.length > 0 && (
                <tr>
                  <td className="px-3 py-2 text-muted-foreground" colSpan={4}>
                    {t("gearLinesSummary", { count: quote.gearLines.length })}
                  </td>
                  <td className="px-3 py-2 text-right">{formatMoney(quote.gearLines.reduce((s, l) => s + l.net, 0))}</td>
                  {canEdit && <td />}
                </tr>
              )}
            </tbody>
            <tfoot className="text-sm">
              {totals.documentDiscount > 0 && (
                <>
                  <tr>
                    <td colSpan={cols - 1} className="px-3 py-1 text-right text-muted-foreground">
                      {t("linesTotal")}
                    </td>
                    <td className="px-3 py-1 text-right">{formatMoney(totals.linesTotal)}</td>
                    {canEdit && <td />}
                  </tr>
                  <tr>
                    <td colSpan={cols - 1} className="px-3 py-1 text-right text-muted-foreground">
                      {t("documentDiscount")} {quote.discountPct}%
                    </td>
                    <td className="px-3 py-1 text-right">−{formatMoney(totals.documentDiscount)}</td>
                    {canEdit && <td />}
                  </tr>
                </>
              )}
              <tr>
                <td colSpan={cols - 1} className="px-3 py-1 text-right text-muted-foreground">
                  {t("subtotal")}
                </td>
                <td className="px-3 py-1 text-right" data-testid="quote-subtotal">
                  {formatMoney(totals.subtotal)}
                </td>
                {canEdit && <td />}
              </tr>
              <tr>
                <td colSpan={cols - 1} className="px-3 py-1 text-right text-muted-foreground">
                  {t("vat", { rate: Math.round(quote.vatRate * 100) })}
                </td>
                <td className="px-3 py-1 text-right">{formatMoney(totals.vat)}</td>
                {canEdit && <td />}
              </tr>
              <tr className="font-medium">
                <td colSpan={cols - 1} className="px-3 py-1 text-right">
                  {t("total")}
                </td>
                <td className="px-3 py-1 text-right" data-testid="quote-total">
                  {formatMoney(totals.total)}
                </td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
      <p className="text-xs text-muted-foreground">{quote.terms ?? t("defaultTerms")}</p>
      {quote.holder.kind === "project" && <p className="text-xs text-muted-foreground">{t("projectQuoteHelp", { edit: tc("edit") })}</p>}
    </section>
  );
}
