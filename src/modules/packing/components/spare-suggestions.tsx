"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { wishFromModel } from "@/modules/wishlist/actions";
import { addLine, dismissSpare } from "../actions";
import type { SpareSuggestionRow } from "../queries";

type Ids = { projectId: string; listId: string };

/**
 * "Suggested spares" under a draft list: parts that fit the gear on it, by
 * the rules on the part. Add puts them on as ordinary lines; Not this time
 * hides one for this list; a shortage can go straight on the wish list.
 */
export function SpareSuggestions({ ids, rows }: { ids: Ids; rows: SpareSuggestionRow[] }) {
  const t = useTranslations("packing");
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-md border border-dashed p-3" aria-label={t("sparesTitle")}>
      <div>
        <h2 className="text-sm font-medium">{t("sparesTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("sparesHelp")}</p>
      </div>
      <ul className="divide-y text-sm">
        {rows.map((r) => (
          <SuggestionRow key={r.partId} ids={ids} row={r} />
        ))}
      </ul>
    </section>
  );
}

function SuggestionRow({ ids, row }: { ids: Ids; row: SpareSuggestionRow }) {
  const t = useTranslations("packing");
  const [state, action] = useActionState<FormState, FormData>(addLine, {});
  return (
    <li className="flex flex-col gap-1 py-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="min-w-0 flex-1">
        <span className="font-medium">{row.wanted}×</span> {row.label}
        <span className="block text-xs text-muted-foreground">
          {t("sparesFor", { models: row.forModels.join(", ") })} · {t("sparesInHouse", { count: row.inHouse })}
          {row.onList > 0 ? ` · ${t("sparesOnList", { count: row.onList })}` : ""}
        </span>
        {state.error && <span className="block text-xs text-destructive">{state.error}</span>}
      </span>
      <span className="flex shrink-0 flex-wrap items-center gap-1">
        {row.add > 0 && (
          <ActionForm action={action}>
            <input type="hidden" name="projectId" value={ids.projectId} />
            <input type="hidden" name="listId" value={ids.listId} />
            <input type="hidden" name="modelId" value={row.partId} />
            <input type="hidden" name="quantity" value={row.add} />
            <SubmitButton size="xs" aria-label={t("sparesAddLabel", { count: row.add, part: row.label })}>
              {t("sparesAdd", { count: row.add })}
            </SubmitButton>
          </ActionForm>
        )}
        {row.short > 0 &&
          (row.onWishList ? (
            <span className="text-xs text-muted-foreground">{t("sparesShortWished", { count: row.short })}</span>
          ) : (
            <form action={wishFromModel}>
              <input type="hidden" name="modelId" value={row.partId} />
              <input type="hidden" name="quantity" value={row.short} />
              <Button type="submit" size="xs" variant="outline">
                {t("sparesShort", { count: row.short })}
              </Button>
            </form>
          ))}
        <form action={dismissSpare}>
          <input type="hidden" name="projectId" value={ids.projectId} />
          <input type="hidden" name="listId" value={ids.listId} />
          <input type="hidden" name="partId" value={row.partId} />
          <Button type="submit" size="xs" variant="ghost">
            {t("sparesDismiss")}
          </Button>
        </form>
      </span>
    </li>
  );
}
