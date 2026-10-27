import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/page-header";
import { can, requirePermission } from "@/lib/auth/session";
import { formatDate, formatMoney } from "@/lib/format";
import { contactOptions } from "@/modules/contacts";
import { AttachmentsSection } from "@/modules/files/components/attachments";
import { purchaseActions, purchaseRow } from "@/modules/purchases";
import { PurchaseDialog } from "@/modules/purchases/components/purchase-forms";

export const metadata: Metadata = { title: "Purchase" };

export default async function PurchasePage(props: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("inventory.finance");
  const { id } = await props.params;
  const p = await purchaseRow(id);
  if (!p) notFound();
  const t = await getTranslations("purchases");
  const ti = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const canEdit = can(actor.role, "inventory.write");
  const suppliers = canEdit ? await contactOptions() : [];
  const title = `${t("title")}: ${p.modelLabel}`;
  const facts: [string, string][] = [
    [t("date"), p.date ? formatDate(p.date) : "—"],
    [t("supplier"), p.supplierName ?? "—"],
    [t("reference"), p.reference ?? "—"],
    [t("quantity"), String(p.quantity)],
    [t("listPrice"), p.listPrice !== null ? formatMoney(p.listPrice) : "—"],
    [t("discountPct"), p.discountPct !== null ? `${p.discountPct} %` : "—"],
    [t("netPrice"), p.netPrice !== null ? formatMoney(p.netPrice) : "—"],
    [t("total"), p.total !== null ? formatMoney(p.total) : "—"],
  ];
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={title}
        subtitle={p.createdByName ? t("addedBy", { name: p.createdByName, date: formatDate(p.createdAt) }) : undefined}
        crumbs={[{ label: ti("title"), href: "/inventory" }, { label: p.modelLabel, href: `/inventory/models/${p.modelId}` }, { label: t("title") }]}
        actions={
          canEdit && (
            <>
              <PurchaseDialog modelId={p.modelId} purchase={p} suppliers={suppliers} trigger="edit" />
              <form action={purchaseActions.deletePurchase}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="modelId" value={p.modelId} />
                <ConfirmButton confirm={t("deleteConfirm")} variant="ghost" className="text-destructive">
                  {tc("delete")}
                </ConfirmButton>
              </form>
            </>
          )
        }
      />
      <dl className="grid max-w-xl grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {p.notes && <p className="max-w-xl whitespace-pre-line text-sm text-muted-foreground">{p.notes}</p>}
      <p className="text-sm">
        <Link href={`/inventory/models/${p.modelId}`} className="underline">
          {t("backToModel")}
        </Link>
      </p>
      <AttachmentsSection entityType="purchase" entityId={p.id} returnTo={`/inventory/purchases/${p.id}`} canEdit={canEdit && can(actor.role, "files.write")} />
    </div>
  );
}
