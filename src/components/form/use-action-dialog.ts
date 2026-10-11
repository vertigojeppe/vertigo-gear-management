"use client";

import { useState } from "react";
import type { FormState } from "@/lib/forms";

/**
 * Open/close state for a dialog that wraps a server-action form.
 * The dialog closes itself when the action returns `ok: true` after it was
 * opened, without needing an effect: we remember which state object was
 * current when the dialog opened and compare.
 */
export function useActionDialog(state: FormState<unknown>): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  const [openedWith, setOpenedWith] = useState<FormState<unknown> | null>(null);
  const isOpen = open && !(state.ok && state !== openedWith);
  const set = (next: boolean) => {
    if (next) setOpenedWith(state);
    setOpen(next);
  };
  return [isOpen, set];
}
