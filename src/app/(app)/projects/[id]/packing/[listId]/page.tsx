import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { ColorBar, ColorDot } from "@/components/color-marks";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setLinesSection } from "@/modules/packing/actions";
import { can, requireActor } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { canCheckIn, canEditLines, gearCatalog, groupLines, listDetail, shareLinks, templateOptions, type LineProgress, listTitle, spareSuggestions } from "@/modules/packing";
import { AddReservedButton, CheckOutButton, DeleteListButton, FinishCheckInButton, ShareLinkControls } from "@/modules/packing/components/list-buttons";
import { ApplyTemplateDialog, EditLineDialog, EditListDialog, RemoveLineButton, SaveAsTemplateDialog } from "@/modules/packing/components/list-dialogs";
import { GearPicker } from "@/modules/packing/components/gear-picker";
import { SpareSuggestions } from "@/modules/packing/components/spare-suggestions";
import { AddExtraForm, ExtraList } from "@/modules/packing/components/extras";
import { PACKING_STATUSES } from "../../../../../../../config/app.config";
import { glossary } from "@/modules/settings";

export async function generateMetadata(props: { params: Promise<{ id: string; listId: string }> }): Promise<Metadata> {
  const { listId } = await props.params;
  return { title: (await listTitle(listId)) ?? "Packing list" };
}

function linePillColor(status: string, p: LineProgress): "green" | "amber" | "red" | "gray" {
  if (status === "draft") return p.toPack === 0 ? "green" : p.packed > 0 ? "amber" : "gray";
  if (p.missing > 0) return "red";
  if (p.damaged > 0) return "amber";
  if (p.packed === 0) return "gray";
  return p.toReturn === 0 ? "green" : "amber";
}

export default async function PackingListPage(props: { params: Promise<{ id: string; listId: string }> }) {
  const actor = await requireActor();
  const { id, listId } = await props.params;
  const detail = await listDetail(listId);
  if (!detail || detail.project.id !== id) notFound();
  const { list, project, lines, totals, progress, subHire, extras } = detail;
  const t = await getTranslations("packing");
  const tp = await getTranslations("projects");
  const ts = await getTranslations("packingStatus");
  const canEdit = can(actor.role, "packing.write");
  const editable = canEdit && canEditLines(list.status);
  const ids = { projectId: id, listId };
  const [catalog, templates, share, spares, glossaryGroups] = await Promise.all([editable ? gearCatalog({ listId }) : [], editable ? templateOptions() : [], shareLinks.current("packing_list", listId), editable ? spareSuggestions(listId) : [], editable ? glossary.groups() : []]);
  const caseOptions = lines.filter((l) => l.isKit && l.itemId).map((l) => ({ id: l.itemId!, label: l.itemName ?? l.itemTag ?? "" }));
  const groups = groupLines(lines, list.groupBy);
  const sections = [...new Set(lines.flatMap((l) => (l.section ? [l.section] : [])))].sort((a, b) => a.localeCompare(b, "da", { numeric: true }));

  return (
    <div data-wide className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {list.name}
            <StatusPill color={PACKING_STATUSES.find((s) => s.key === list.status)?.color ?? "gray"} className="text-sm">
              {ts(list.status)}
            </StatusPill>
          </span>
        }
        subtitle={
          <>
            {t("totalsLine", { units: progress.units, cases: totals.cases, weight: totals.weightKg, power: totals.powerW })}
            {totals.unknownWeight > 0 ? ` · ${t("unknownWeight", { count: totals.unknownWeight })}` : ""}
            {list.checkedOutAt ? ` · ${t("checkedOutAt", { date: formatDateTime(list.checkedOutAt) })}` : ""}
            {list.checkedInAt ? ` · ${t("checkedInAt", { date: formatDateTime(list.checkedInAt) })}` : ""}
          </>
        }
        crumbs={[{ label: tp("title"), href: "/projects" }, { label: project.name, href: `/projects/${id}` }, { label: list.name }]}
        actions={
          <>
            {editable && (
              <Link href={`/projects/${id}/packing/${listId}/pack`} className={buttonVariants({ size: "sm" })}>
                {t("pack")}
              </Link>
            )}
            {editable && <CheckOutButton ids={ids} packed={progress.packed} />}
            {canEdit && canCheckIn(list.status) && (
              <>
                <Link href={`/projects/${id}/packing/${listId}/checkin`} className={buttonVariants({ size: "sm" })}>
                  {t("checkIn")}
                </Link>
                <FinishCheckInButton ids={ids} stillOut={progress.toReturn} />
              </>
            )}
            <a href={`/api/packing/${listId}/list.pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("pdf")}
            </a>
            {canEdit && <EditListDialog ids={ids} list={list} />}
            {canEdit && <SaveAsTemplateDialog listId={listId} defaultName={list.name} />}
            {canEdit && list.status !== "checked_out" && <DeleteListButton ids={ids} />}
          </>
        }
      />

      {list.status === "checked_out" && <p className="text-sm text-muted-foreground">{t("onSiteNote")}</p>}
      {list.status !== "draft" && (
        <p className="text-sm">
          {t("returned", { returned: progress.returnedOk, packed: progress.packed })}
          {progress.damaged > 0 ? ` · ${progress.damaged} ${t("outcomeDamaged").toLowerCase()}` : ""}
          {progress.missing > 0 ? ` · ${progress.missing} ${t("outcomeMissing").toLowerCase()}` : ""}
          {progress.used > 0 ? ` · ${progress.used} ${t("outcomeUsed").toLowerCase()}` : ""}
        </p>
      )}

      {editable && (
        <>
          <GearPicker target={{ kind: "list", ...ids }} catalog={catalog} cases={caseOptions} glossaryGroups={glossaryGroups} />
          <SpareSuggestions ids={ids} rows={spares} />
          <AddExtraForm ids={ids} />
          <div className="flex flex-wrap gap-2">
            {templates.length > 0 && <ApplyTemplateDialog ids={ids} templates={templates.map((x) => ({ id: x.id, label: `${x.name} (${x._count.lines})` }))} />}
            <AddReservedButton ids={ids} />
          </div>
        </>
      )}

      {lines.length === 0 && extras.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">{t("noLines")}</p>
          <p className="text-sm text-muted-foreground">{t("noLinesBody")}</p>
        </div>
      )}

      {editable && lines.length > 0 && (
        // The line checkboxes belong to this form through their form attribute; a plain form, so it resets after a move.
        <form id="section-form" action={setLinesSection} className="flex flex-col gap-1">
          <input type="hidden" name="projectId" value={id} />
          <input type="hidden" name="listId" value={listId} />
          <p className="text-xs text-muted-foreground">{t("sectionMoveHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input name="section" list="section-form-sections" maxLength={60} placeholder={t("sectionExample")} aria-label={t("section")} className="min-w-0 flex-[1_1_12rem] sm:max-w-xs" />
            <datalist id="section-form-sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              {t("sectionMove")}
            </button>
          </div>
        </form>
      )}

      {/* With the roomy layout, groups flow into columns on wide screens; a group never breaks across two. */}
      {(lines.length > 0 || subHire.length > 0 || extras.length > 0) && (
        <div className="gap-6 roomy:lg:columns-2 roomy:2xl:columns-3">
          {groups.map((g) => (
            <section key={g.key} className="mb-5 flex break-inside-avoid flex-col gap-1">
              <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ColorBar color={g.color} className="h-4" />
                {g.label}
              </h2>
              <ul className="divide-y rounded-md border text-sm">
                {g.lines.map((l) => (
                  <li key={l.id} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                    <span className={`flex shrink-0 items-center gap-2 font-medium ${editable ? "sm:w-16" : "w-10"}`}>
                      {editable && <input type="checkbox" name="lineId" value={l.id} form="section-form" aria-label={`${t("selectLine")}: ${l.modelLabel}`} className="size-4" />}
                      {l.quantity}×
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link href={`/inventory/models/${l.modelId}`} className="hover:underline">
                        {l.modelLabel}
                      </Link>
                      <ColorDot color={l.lengthColor} className="ml-1.5" />
                      {l.itemName ? <span className="text-muted-foreground"> – {l.itemName}</span> : null}
                      <span className="block text-xs text-muted-foreground">
                        {[l.note && l.note !== l.itemName ? l.note : null, l.itemTag && !l.isKit ? l.itemTag : null, l.caseLabel && !l.isKit ? `${t("case")}: ${l.caseLabel}` : null, l.section && list.groupBy !== "section" ? `${t("section")}: ${l.section}` : null].filter(Boolean).join(" · ")}
                        {l.isKit && l.kitContents.length > 0 ? `${t("contains")}: ${l.kitContents.map((c) => `${c.quantity > 1 ? `${c.quantity}× ` : ""}${c.label}`).join(", ")}` : ""}
                      </span>
                      {list.status === "draft" && !l.isKit && l.quantity > l.inHouse && <span className="block text-xs text-amber-700 dark:text-amber-300">{t("inHouseHint", { count: l.inHouse, owned: l.owned })}</span>}
                      {l.checks.filter((c) => c.phase === "out").length > 0 && (
                        <span className="block font-mono text-xs text-muted-foreground">{l.checks.filter((c) => c.phase === "out").map((c) => `${c.assetTag ?? ""}${l.trackingType === "bulk" ? ` ×${c.quantity}` : ""}`).join(", ")}</span>
                      )}
                    </span>
                    <StatusPill color={linePillColor(list.status, l.progress)} className="shrink-0">
                      {list.status === "draft" ? `${l.progress.packed}/${l.quantity}` : t("returned", { returned: l.progress.returnedOk, packed: l.progress.packed })}
                      {list.status !== "draft" && l.progress.damaged > 0 ? ` · ${l.progress.damaged} ${t("outcomeDamaged").toLowerCase()}` : ""}
                      {list.status !== "draft" && l.progress.missing > 0 ? ` · ${l.progress.missing} ${t("outcomeMissing").toLowerCase()}` : ""}
                      {list.status !== "draft" && l.progress.used > 0 ? ` · ${l.progress.used} ${t("outcomeUsed").toLowerCase()}` : ""}
                      {list.status !== "draft" && l.progress.packed < l.quantity ? ` · ${t("notPacked").toLowerCase()} ${l.quantity - l.progress.packed}` : ""}
                    </StatusPill>
                    {editable && (
                      <span className="flex shrink-0 items-center gap-1">
                        <EditLineDialog ids={ids} line={l} cases={caseOptions} units={l.availableUnits} sections={sections} />
                        <RemoveLineButton ids={ids} lineId={l.id} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {subHire.length > 0 && (
            <section className="mb-5 flex break-inside-avoid flex-col gap-1">
              <h2 className="text-sm font-medium text-muted-foreground">{t("rentedIn")}</h2>
              <ul className="divide-y rounded-md border text-sm">
                {subHire.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-10 shrink-0 font-medium">{l.quantity}×</span>
                    <span className="min-w-0 flex-1">
                      {l.label}
                      <span className="block text-xs text-muted-foreground">
                        {t("rentInFrom", { owner: l.ownerName })}
                        {l.note ? ` · ${l.note}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ExtraList ids={ids} extras={extras} canTick={editable} editable={editable} canAddToInventory={can(actor.role, "inventory.write")} />
        </div>
      )}

      {list.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{list.notes}</p>}

      {can(actor.role, "share.create") && <ShareLinkControls ids={ids} path={share ? `/share/packing/${share.token}` : null} />}
    </div>
  );
}
