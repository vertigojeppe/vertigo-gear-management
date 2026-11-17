import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addExtra, removeExtra, setExtraPacked } from "../actions";
import type { ExtraRow } from "../queries";

type Ids = { projectId: string; listId: string };

function Hidden({ ids }: { ids: Ids }) {
  return (
    <>
      <input type="hidden" name="projectId" value={ids.projectId} />
      <input type="hidden" name="listId" value={ids.listId} />
    </>
  );
}

/**
 * The list's lines for things not in the inventory: gear to add later, or
 * stuff not worth tracking (wire cut to length). Ticked when packed (only
 * while packing), never checked out or in. Plain forms, so it works in the
 * list page, pack mode and without JavaScript.
 */
export function ExtraList({ ids, extras, canTick, editable, canAddToInventory }: { ids: Ids; extras: ExtraRow[]; canTick: boolean; editable: boolean; canAddToInventory: boolean }) {
  const t = useTranslations("packing");
  if (extras.length === 0) return null;
  return (
    <section className="mb-5 flex break-inside-avoid flex-col gap-1">
      <h2 className="text-sm font-medium text-muted-foreground">{t("notInInventory")}</h2>
      <ul className="divide-y rounded-md border text-sm">
        {extras.map((x) => (
          <li key={x.id} className="flex items-center gap-3 px-3 py-2">
            {canTick ? (
              <form action={setExtraPacked}>
                <Hidden ids={ids} />
                <input type="hidden" name="extraId" value={x.id} />
                <input type="hidden" name="packed" value={x.packed ? "0" : "1"} />
                <Button type="submit" variant={x.packed ? "default" : "outline"} size="icon" className="size-9" aria-label={`${x.packed ? t("extraUntick") : t("extraTick")}: ${x.name}`} aria-pressed={x.packed}>
                  <Check aria-hidden className={x.packed ? "" : "opacity-30"} />
                </Button>
              </form>
            ) : (
              <span className="w-10 shrink-0 text-center">{x.packed ? <Check aria-label={t("extraPacked")} className="mx-auto size-4 text-green-600" /> : null}</span>
            )}
            <span className="w-10 shrink-0 font-medium">{x.quantity}×</span>
            <span className="min-w-0 flex-1">
              {x.name}
              {(x.note || x.modelId || canAddToInventory) && (
                <span className="block text-xs text-muted-foreground">
                  {x.note}
                  {x.note && (x.modelId || canAddToInventory) ? " · " : ""}
                  {x.modelId ? (
                    <Link href={`/inventory/models/${x.modelId}`} className="underline">
                      {t("inInventory", { model: x.modelLabel ?? x.name })}
                    </Link>
                  ) : canAddToInventory ? (
                    <Link href={`/inventory/models/new?extra=${x.id}`} className="underline">
                      {t("addToInventory")}
                    </Link>
                  ) : null}
                </span>
              )}
            </span>
            {editable && (
              <form action={removeExtra}>
                <Hidden ids={ids} />
                <input type="hidden" name="extraId" value={x.id} />
                <Button type="submit" variant="ghost" size="icon" className="text-destructive" aria-label={`${t("extraRemove")}: ${x.name}`}>
                  <X aria-hidden />
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One line for something not in the inventory: what, how many, a note. */
export function AddExtraForm({ ids }: { ids: Ids }) {
  const t = useTranslations("packing");
  return (
    <form action={addExtra} className="flex flex-col gap-1">
      <Hidden ids={ids} />
      <p className="text-xs text-muted-foreground">{t("extraHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input name="name" required maxLength={120} placeholder={t("extraName")} aria-label={t("extraName")} className="min-w-0 flex-[2_1_12rem]" />
        <Input name="quantity" type="number" min={1} defaultValue={1} aria-label={t("extraQuantity")} className="w-20" />
        <Input name="note" maxLength={500} placeholder={t("extraNote")} aria-label={t("extraNote")} className="min-w-0 flex-[1_1_8rem]" />
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          {t("extraAdd")}
        </button>
      </div>
    </form>
  );
}
