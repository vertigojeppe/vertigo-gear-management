import { LiveFilterForm } from "@/components/form/live-filter-form";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { kitCandidates } from "../queries";
import type { ItemDto } from "../service";
import { AddToKitButton } from "./add-to-kit-button";
import { removeItemFromKit } from "../actions";

/** Contents of a kit + search-and-add. Server component. */
export async function KitSection({
  kit,
  contents,
  q,
  canEdit,
}: {
  kit: ItemDto;
  contents: (ItemDto & { modelLabel: string })[];
  q: string | undefined;
  canEdit: boolean;
}) {
  const t = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const candidates = canEdit && q ? await kitCandidates(kit.id, q) : [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">
        {t("contents")} <span className="text-sm font-normal text-muted-foreground">({contents.length})</span>
      </h2>
      {contents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noContents")}</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {contents.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2">
              <Link href={`/inventory/items/${c.id}`} className="font-mono text-xs">
                {c.assetTag}
              </Link>
              <span className="min-w-0 flex-1 truncate">
                {c.modelLabel}
                {c.name ? ` · ${c.name}` : ""}
                {c.serialNumber ? ` · SN ${c.serialNumber}` : ""}
                {c.quantity > 1 ? ` · ×${c.quantity}` : ""}
              </span>
              <StatusBadge status={c.status} />
              {canEdit && (
                <form action={removeItemFromKit}>
                  <input type="hidden" name="itemId" value={c.id} />
                  <Button type="submit" variant="ghost" size="xs">
                    {t("removeFromKit")}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
          <LiveFilterForm className="flex gap-2" action={`/inventory/items/${kit.id}`}>
            <Input name="q" defaultValue={q ?? ""} placeholder={t("addToKitHelp")} aria-label={t("addToKit")} />
            <Button type="submit" variant="outline" className="group-data-[live]:hidden">
              {tc("search")}
            </Button>
          </LiveFilterForm>
          {q && candidates.length === 0 && <p className="text-sm text-muted-foreground">{tc("results", { count: 0 })}</p>}
          {candidates.length > 0 && (
            <ul className="divide-y text-sm">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-1.5">
                  <span className="font-mono text-xs">{c.assetTag}</span>
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <AddToKitButton kitId={kit.id} itemId={c.id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
