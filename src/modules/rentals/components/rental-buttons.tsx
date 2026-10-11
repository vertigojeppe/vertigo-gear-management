"use client";

import { useTranslations } from "next-intl";
import { ConfirmButton } from "@/components/form/confirm-button";
import { deleteRental, markRentalOut, markRentalReturned } from "../actions";

export function RentalStatusButtons({ rentalId, status }: { rentalId: string; status: string }) {
  const t = useTranslations("rentals");
  return (
    <>
      {status === "reserved" && (
        <form action={markRentalOut}>
          <input type="hidden" name="id" value={rentalId} />
          <ConfirmButton confirm={t("markOutConfirm")} size="sm">
            {t("markOut")}
          </ConfirmButton>
        </form>
      )}
      {status === "out" && (
        <form action={markRentalReturned}>
          <input type="hidden" name="id" value={rentalId} />
          <ConfirmButton confirm={t("markReturnedConfirm")} size="sm">
            {t("markReturned")}
          </ConfirmButton>
        </form>
      )}
    </>
  );
}

export function DeleteRentalButton({ rentalId }: { rentalId: string }) {
  const t = useTranslations("rentals");
  const tc = useTranslations("common");
  return (
    <form action={deleteRental}>
      <input type="hidden" name="id" value={rentalId} />
      <ConfirmButton confirm={t("deleteConfirm")} variant="ghost" size="sm" className="text-destructive">
        {tc("delete")}
      </ConfirmButton>
    </form>
  );
}
