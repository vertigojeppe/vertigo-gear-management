import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Paperclip } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { contactOptions } from "@/modules/contacts";
import { purchasesForModel } from "../queries";
import { PurchaseDialog } from "./purchase-forms";

/** Purchase records of a model. Server component; the page checks `inventory.finance` before rendering it. */
export async function PurchasesSection({ modelId, canEdit }: { modelId: string; canEdit: boolean }) {
  const t = await getTranslations("purchases");
  const [rows, suppliers] = await Promise.all([purchasesForModel(modelId), canEdit ? contactOptions() : Promise.resolve([])]);
  const total = rows.reduce((sum, r) => (r.total === null ? sum : sum + r.total), 0);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">
          {t("title")} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
        </h2>
        {canEdit && <PurchaseDialog modelId={modelId} suppliers={suppliers} trigger="new" />}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <>
          <ul className="divide-y rounded-md border text-sm">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/inventory/purchases/${p.id}`} className="flex flex-col gap-1 px-3 py-2 hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{p.date ? formatDate(p.date) : "—"}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {p.quantity} × {p.netPrice !== null ? formatMoney(p.netPrice) : "—"}
                    {p.discountPct !== null && p.listPrice !== null ? <span className="text-muted-foreground"> ({t("listLess", { price: formatMoney(p.listPrice), pct: p.discountPct })})</span> : null}
                    {p.supplierName ? <span className="text-muted-foreground"> · {p.supplierName}</span> : null}
                    {p.reference ? <span className="text-muted-foreground"> · {p.reference}</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {p.attachments > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="size-3" aria-hidden /> {p.attachments}
                      </span>
                    )}
                    <span className="font-medium">{p.total !== null ? formatMoney(p.total) : ""}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t("totalPaid", { amount: formatMoney(total) })}</p>
        </>
      )}
    </section>
  );
}
