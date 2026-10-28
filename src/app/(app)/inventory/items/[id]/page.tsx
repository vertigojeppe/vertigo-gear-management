import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActivityList } from "@/components/activity-list";
import { CustomFieldValuesList } from "@/components/form/custom-field-inputs";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/page-header";
import { applicableDefs } from "@/lib/custom-fields";
import { QrImage } from "@/components/qr-image";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { can, requireActor } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatMoney, modelLabel } from "@/lib/format";
import { ModelName } from "@/components/model-name";
import { AttachmentsSection } from "@/modules/files/components/attachments";
import { inventoryActions, itemDetail, locationOptions } from "@/modules/inventory";
import { KitSection } from "@/modules/inventory/components/kit-section";
import { MoveDialog, StatusDialog } from "@/modules/inventory/components/item-actions";
import { LabelsDialog } from "@/modules/inventory/components/labels-dialog";
import { customFieldDefinitions } from "@/modules/settings";

export const metadata: Metadata = { title: "Item" };

export default async function ItemPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor();
  const { id } = await props.params;
  const { q } = await props.searchParams;
  const [detail, defs, locs] = await Promise.all([itemDetail(id), customFieldDefinitions.forEntity("item"), locationOptions()]);
  if (!detail) notFound();
  const { item, model } = detail;
  const t = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const tl = await getTranslations("locationType");
  const trr = await getTranslations("retiredReason");
  const canEdit = can(actor.role, "inventory.write");
  const canSeeFinance = can(actor.role, "inventory.finance");
  const isAdmin = can(actor.role, "users.manage");
  const label = modelLabel(model);
  const title = item.name ? `${item.name}` : label;
  const returnTo = `/inventory/items/${item.id}`;

  const facts: [string, React.ReactNode][] = [
    [t("assetTag"), <span key="tag" className="font-mono">{item.assetTag}</span>],
    [t("model"), <Link key="model" href={`/inventory/models/${model.id}`} className="underline"><ModelName model={model} /></Link>],
    [t("category"), detail.categoryPath.join(" › ")],
  ];
  if (model.trackingType === "bulk") facts.push([t("quantity"), String(item.quantity)]);
  else facts.push([t("serialNumber"), item.serialNumber ?? t("noSerial")]);
  facts.push([t("location"), detail.location ? `${detail.location.name} (${tl(detail.location.type)})` : t("noLocation")]);
  if (detail.parentItem) facts.push([t("inKit"), <Link key="kit" href={`/inventory/items/${detail.parentItem.id}`} className="underline">{detail.parentItem.label}</Link>]);
  if (item.status === "retired" && item.retiredReason) facts.push([t("retiredReason"), trr(item.retiredReason as "sold")]);
  if (item.conditionNotes) facts.push([t("conditionNotes"), item.conditionNotes]);
  if (item.notes) facts.push([tc("notes"), item.notes]);

  const finance: [string, string][] = [];
  if (canSeeFinance) {
    if (item.purchaseDate) finance.push([t("purchaseDate"), formatDate(item.purchaseDate)]);
    if (item.supplier) finance.push([t("supplier"), item.supplier]);
    if (item.purchasePrice !== null) finance.push([t("purchasePrice", { currency: "" }).replace(" ()", ""), formatMoney(item.purchasePrice)]);
    if (item.insuredValue !== null) finance.push([t("insuredValue", { currency: "" }).replace(" ()", ""), formatMoney(item.insuredValue)]);
    if (item.replacementValue !== null) finance.push([t("replacementValue", { currency: "" }).replace(" ()", ""), formatMoney(item.replacementValue)]);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {item.isKit && <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase">{t("kit")}</span>}
            {title}
            {(item.notForRental || model.notForRental) && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{t("notForRental")}</span>}
            <StatusBadge status={item.status} className="text-sm" />
          </span>
        }
        subtitle={item.name ? label : undefined}
        crumbs={[{ label: t("title"), href: "/inventory" }, { label: t("items"), href: "/inventory/items" }, { label: item.assetTag }]}
        actions={
          canEdit && (
            <>
              <StatusDialog itemId={item.id} current={item.status} isKit={item.isKit} locations={locs} />
              <MoveDialog itemId={item.id} current={item.locationId} isKit={item.isKit} locations={locs} />
              <Link href={`/inventory/items/${item.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {tc("edit")}
              </Link>
              {isAdmin && (
                <form action={inventoryActions.deleteItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="modelId" value={model.id} />
                  <ConfirmButton confirm={t("deleteItemConfirm")} variant="ghost" size="sm" className="text-destructive">
                    {tc("delete")}
                  </ConfirmButton>
                </form>
              )}
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_200px]">
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          {finance.length > 0 && (
            <div>
              <h2 className="mb-1 text-sm font-medium">{t("finance")}</h2>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                {finance.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <CustomFieldValuesList defs={applicableDefs(defs, model.categoryId)} values={item.customFields} />
        </div>
        <div className="flex flex-col items-center gap-2 rounded-md border p-3">
          <QrImage itemId={item.id} assetTag={item.assetTag} className="size-40" />
          <p className="font-mono text-sm">{item.assetTag}</p>
          <p className="text-center text-xs text-muted-foreground">{t("qrHelp")}</p>
          <a href={`/t/${encodeURIComponent(item.assetTag)}`} className="text-xs underline">
            {t("openTag")}
          </a>
          <LabelsDialog query={`ids=${item.id}`} count={1} variant="ghost" />
          {detail.photoUrl && (
            <a href={detail.photoUrl} className="mt-2 w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.thumbUrl ?? detail.photoUrl} alt={label} className="w-full rounded object-cover" />
            </a>
          )}
        </div>
      </div>

      {item.isKit && <KitSection kit={item} contents={detail.contents} q={q} canEdit={canEdit} />}

      <AttachmentsSection entityType="item" entityId={item.id} returnTo={returnTo} canEdit={can(actor.role, "files.write")} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t("statusHistory")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">{t("when")}</th>
                <th className="py-1 pr-3 font-medium">{t("fromStatus")}</th>
                <th className="py-1 pr-3 font-medium">{t("toStatus")}</th>
                <th className="py-1 pr-3 font-medium">{t("reason")}</th>
                <th className="py-1 font-medium">{t("who")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {detail.statusLogs.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{formatDateTime(l.createdAt)}</td>
                  <td className="py-1.5 pr-3">{l.fromStatus ? <StatusBadge status={l.fromStatus} /> : "—"}</td>
                  <td className="py-1.5 pr-3">
                    <StatusBadge status={l.toStatus} />
                  </td>
                  <td className="py-1.5 pr-3">{l.reason ?? ""}</td>
                  <td className="py-1.5">{l.userName ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{tc("activity")}</h2>
        <ActivityList rows={detail.activity} />
      </section>
    </div>
  );
}
