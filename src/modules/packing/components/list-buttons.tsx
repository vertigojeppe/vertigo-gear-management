"use client";

import { useTranslations } from "next-intl";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Button } from "@/components/ui/button";
import { addReservedLines, checkOutList, createShareLink, deletePackingList, finishCheckIn, revokeShareLink } from "../actions";

type Ids = { projectId: string; listId: string };

function Hidden({ ids }: { ids: Ids }) {
  return (
    <>
      <input type="hidden" name="projectId" value={ids.projectId} />
      <input type="hidden" name="listId" value={ids.listId} />
    </>
  );
}

export function CheckOutButton({ ids, packed }: { ids: Ids; packed: number }) {
  const t = useTranslations("packing");
  return (
    <form action={checkOutList}>
      <Hidden ids={ids} />
      <ConfirmButton confirm={t("checkOutConfirm", { packed })} size="sm" disabled={packed === 0}>
        {t("checkOut")}
      </ConfirmButton>
    </form>
  );
}

export function FinishCheckInButton({ ids, stillOut }: { ids: Ids; stillOut: number }) {
  const t = useTranslations("packing");
  return (
    <form action={finishCheckIn}>
      <Hidden ids={ids} />
      <ConfirmButton confirm={t("finishConfirm", { count: stillOut })} size="sm" variant={stillOut > 0 ? "outline" : "default"}>
        {t("finishCheckIn")}
      </ConfirmButton>
    </form>
  );
}

export function AddReservedButton({ ids }: { ids: Ids }) {
  const t = useTranslations("packing");
  return (
    <form action={addReservedLines}>
      <Hidden ids={ids} />
      <Button type="submit" size="sm" variant="outline">
        {t("addReserved")}
      </Button>
    </form>
  );
}

export function DeleteListButton({ ids }: { ids: Ids }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  return (
    <form action={deletePackingList}>
      <Hidden ids={ids} />
      <ConfirmButton confirm={t("deleteConfirm")} size="sm" variant="ghost" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}

export function ShareLinkControls({ ids, url }: { ids: Ids; url: string | null }) {
  const t = useTranslations("packing");
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
      <div>
        <p className="font-medium">{t("share")}</p>
        <p className="text-xs text-muted-foreground">{t("shareHelp")}</p>
      </div>
      {url ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs" title={url}>
            {url}
          </code>
          <form action={revokeShareLink}>
            <Hidden ids={ids} />
            <ConfirmButton confirm={t("revokeShare") + "?"} size="xs" variant="ghost" className="text-destructive">
              {t("revokeShare")}
            </ConfirmButton>
          </form>
        </div>
      ) : (
        <form action={createShareLink}>
          <Hidden ids={ids} />
          <Button type="submit" size="sm" variant="outline">
            {t("createShare")}
          </Button>
        </form>
      )}
    </div>
  );
}
