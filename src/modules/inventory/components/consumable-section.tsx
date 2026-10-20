import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatusPill } from "@/components/status-pill";
import type { ModelChoice } from "@/components/form/model-select";
import { formatDateTime } from "@/lib/format";
import { consumableDetail, sparePartsFor } from "../consumables";
import { formatQty, isMetres } from "../consumables-logic";
import { AddFitForm, MetresDialog, RemoveFitButton, UseConsumableDialog } from "./consumable-dialogs";

/**
 * A consumable's stock, its "use / receive / count" actions, the models it
 * fits and the usage history. Server component on the model page.
 */
export async function ConsumableSection({ modelId, canEdit, projects, models }: { modelId: string; canEdit: boolean; projects: { id: string; name: string }[]; models: ModelChoice[] }) {
  const t = await getTranslations("consumables");
  const d = await consumableDetail(modelId);
  if (!d) return null;
  const pcs = t("pcs");
  const fmt = (q: number) => formatQty(q, d.unit, pcs);
  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{isMetres(d.unit) ? t("metresHelp") : t("piecesHelp")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-semibold" data-testid="consumable-stock">
            {fmt(d.stock)}
          </span>
          {d.low ? <StatusPill color="red">{t("low", { min: fmt(d.minStock ?? 0) })}</StatusPill> : d.minStock !== null ? <span className="text-xs text-muted-foreground">{t("minimum", { min: fmt(d.minStock) })}</span> : null}
        </div>
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <UseConsumableDialog modelId={modelId} unit={d.unit} projects={projects} />
          {isMetres(d.unit) && <MetresDialog modelId={modelId} mode="receive" />}
          {isMetres(d.unit) && <MetresDialog modelId={modelId} mode="count" />}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("fits")}</h3>
        <p className="text-xs text-muted-foreground">{t("fitsHelp")}</p>
        {d.fits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fitsNone")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {d.fits.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-1.5">
                <Link href={`/inventory/models/${f.modelId}`} className="min-w-0 flex-1 truncate hover:underline">
                  {f.label}
                </Link>
                <span className="text-xs text-muted-foreground">{t("rule", { per: f.perUnits, min: f.minQty })}</span>
                {canEdit && <RemoveFitButton id={f.id} />}
              </li>
            ))}
          </ul>
        )}
        {canEdit && <AddFitForm partId={modelId} models={models.filter((m) => m.id !== modelId)} />}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("history")}</h3>
        {d.movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("historyNone")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {d.movements.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5">
                <span className={`w-20 shrink-0 font-medium ${r.quantity < 0 ? "" : "text-green-700 dark:text-green-400"}`}>
                  {r.quantity > 0 ? "+" : ""}
                  {fmt(r.quantity)}
                </span>
                <span className="min-w-0 flex-1">
                  {t(`kind_${r.kind}` as "kind_used")}
                  {r.itemTag && r.itemId ? (
                    <>
                      {" · "}
                      <Link href={`/inventory/items/${r.itemId}`} className="font-mono text-xs hover:underline">
                        {r.itemTag}
                      </Link>
                    </>
                  ) : null}
                  {r.projectName && r.projectId ? (
                    <>
                      {" · "}
                      <Link href={`/projects/${r.projectId}`} className="hover:underline">
                        {r.projectName}
                      </Link>
                    </>
                  ) : null}
                  {r.note ? <span className="text-muted-foreground"> · {r.note}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.userName ? `${r.userName} · ` : ""}
                  {formatDateTime(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** "Spare parts" on a model page: the consumables that fit it, with stock. */
export async function SparePartsSection({ modelId }: { modelId: string }) {
  const rows = await sparePartsFor(modelId);
  if (rows.length === 0) return null;
  const t = await getTranslations("consumables");
  const pcs = t("pcs");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">{t("spareParts")}</h2>
      <ul className="divide-y rounded-md border text-sm">
        {rows.map((p) => (
          <li key={p.fitId}>
            <Link href={`/inventory/models/${p.partId}`} className="flex items-center gap-3 px-3 py-1.5 hover:bg-muted/50">
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              <span className="text-xs text-muted-foreground">{t("rule", { per: p.perUnits, min: p.minQty })}</span>
              <StatusPill color={p.low ? "red" : p.stock > 0 ? "green" : "gray"}>{formatQty(p.stock, p.unit, pcs)}</StatusPill>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
