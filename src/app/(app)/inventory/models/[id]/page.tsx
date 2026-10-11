import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Package } from "lucide-react";
import { ActivityList } from "@/components/activity-list";
import { CustomFieldValuesList } from "@/components/form/custom-field-inputs";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { can, requireActor } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { AttachmentsSection } from "@/modules/files";
import { inventoryActions, modelDetail } from "@/modules/inventory";
import { customFieldDefinitions } from "@/modules/settings";
import { modelAvailabilityView } from "@/modules/projects";
import { StatusPill } from "@/components/status-pill";
import { ITEM_STATUSES } from "../../../../../../config/app.config";

export const metadata: Metadata = { title: "Model" };

export default async function ModelPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await requireActor();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const ok = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const [detail, defs, availability] = await Promise.all([modelDetail(id), customFieldDefinitions.forEntity("model"), modelAvailabilityView(id, ok(sp.from), ok(sp.to))]);
  const tp = await getTranslations("projects");
  if (!detail) notFound();
  const { model, items } = detail;
  const t = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const ts = await getTranslations("itemStatus");
  const canEdit = can(actor.role, "inventory.write");
  const label = `${model.manufacturer} ${model.name}`;

  const specs: [string, string][] = [];
  if (model.weightKg !== null) specs.push([t("weightKg"), formatNumber(model.weightKg, 3)]);
  if (model.widthCm !== null || model.heightCm !== null || model.depthCm !== null) {
    specs.push([t("dimensions"), [model.widthCm, model.heightCm, model.depthCm].map((v) => (v === null ? "–" : formatNumber(v, 1))).join(" × ")]);
  }
  if (model.powerDrawW !== null) specs.push([t("powerDrawW"), String(model.powerDrawW)]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={label}
        subtitle={`${detail.categoryPath.join(" › ")} · ${t(model.trackingType)}${model.archived ? ` · ${t("archived")}` : ""}`}
        crumbs={[{ label: t("title"), href: "/inventory" }, { label }]}
        actions={
          canEdit && (
            <>
              <Link href={`/inventory/items/new?modelId=${model.id}`} className={buttonVariants()}>
                {t("newItem")}
              </Link>
              <Link href={`/inventory/models/${model.id}/edit`} className={buttonVariants({ variant: "outline" })}>
                {tc("edit")}
              </Link>
              <form action={inventoryActions.setModelArchived}>
                <input type="hidden" name="id" value={model.id} />
                <input type="hidden" name="archived" value={model.archived ? "false" : "true"} />
                <Button type="submit" variant="ghost">
                  {model.archived ? t("unarchive") : t("archive")}
                </Button>
              </form>
              {items.length === 0 && (
                <form action={inventoryActions.deleteModel}>
                  <input type="hidden" name="id" value={model.id} />
                  <ConfirmButton confirm={t("deleteModelConfirm")} variant="ghost" className="text-destructive">
                    {tc("delete")}
                  </ConfirmButton>
                </form>
              )}
            </>
          )
        }
      />

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
          {detail.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.thumbUrl ?? detail.photoUrl} alt={label} className="size-full object-cover" />
          ) : (
            <Package className="size-10" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-4">
          {model.description && <p className="text-sm whitespace-pre-line">{model.description}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h2 className="mb-1 text-sm font-medium">{t("byStatus")}</h2>
              <ul className="flex flex-wrap gap-2 text-sm">
                {ITEM_STATUSES.map((s) => (
                  <li key={s.key} className="flex items-center gap-1">
                    <StatusBadge status={s.key} />
                    <span>{detail.byStatus[s.key] ?? 0}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">{t("unitsOwned", { count: detail.owned })}</p>
            </div>
            {specs.length > 0 && (
              <div>
                <h2 className="mb-1 text-sm font-medium">{t("specs")}</h2>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                  {specs.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
          {model.links.length > 0 && (
            <ul className="flex flex-wrap gap-3 text-sm">
              {model.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer" className="underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <CustomFieldValuesList defs={defs} values={model.customFields} />
          {model.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{model.notes}</p>}
          <p className="text-xs text-muted-foreground">{ts("in_house")}: {detail.byStatus.in_house ?? 0} · {t("owned")}: {detail.owned}</p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">
            {t("items")} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
          </h2>
          <Link href={`/inventory/items?modelId=${model.id}`} className="text-sm underline">
            {t("viewItems")}
          </Link>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noItemsForModel")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {items.map((i) => (
              <li key={i.id}>
                <Link href={`/inventory/items/${i.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <span className="font-mono text-xs">{i.assetTag}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {i.name ? `${i.name} · ` : ""}
                    {model.trackingType === "bulk" ? `×${i.quantity}` : i.serialNumber ? `SN ${i.serialNumber}` : t("noSerial")}
                    {i.parentItem ? ` · ${t("inKit")}: ${i.parentItem.label}` : ""}
                  </span>
                  <span className="hidden text-muted-foreground sm:inline">{i.locationName ?? t("noLocation")}</span>
                  <StatusBadge status={i.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{tp("reservations")}</h2>
        <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{tp("from")}</span>
            <input type="date" name="from" defaultValue={availability.window.from} className="h-8 rounded-md border bg-background px-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{tp("to")}</span>
            <input type="date" name="to" defaultValue={availability.window.to} className="h-8 rounded-md border bg-background px-2" />
          </label>
          <Button type="submit" variant="outline" size="sm">
            {tc("filter")}
          </Button>
          <StatusPill color={availability.available > 0 ? "green" : "red"} className="ml-2 text-sm">
            {tp("available", { count: availability.available })}
          </StatusPill>
          <span className="text-xs text-muted-foreground">
            {t("owned")} {availability.owned} · {ts("in_repair")}/{ts("missing")} {availability.unavailable} · {tp("reservations").toLowerCase()} {availability.allocated}
          </span>
        </form>
        {availability.upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tp("noReservations")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {availability.upcoming.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-10 font-medium">{a.quantity}×</span>
                <Link href={a.holderType === "project" ? `/projects/${a.holderId}` : `/rentals/${a.holderId}`} className="min-w-0 flex-1 truncate hover:underline">
                  {a.holderName}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {a.startDate} – {a.endDate}
                </span>
              </li>
            ))}
          </ul>
        )}
        {availability.overbooked.length > 0 && (
          <p className="text-sm text-red-700 dark:text-red-300">
            {tp("overbooked")}: {availability.overbooked.map((d) => `${d.day} (−${d.shortfall})`).join(", ")}
          </p>
        )}
      </section>

      <AttachmentsSection entityType="model" entityId={model.id} returnTo={`/inventory/models/${model.id}`} canEdit={can(actor.role, "files.write")} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{tc("activity")}</h2>
        <ActivityList rows={detail.activity} />
      </section>
    </div>
  );
}
