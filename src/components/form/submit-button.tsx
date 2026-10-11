"use client";

import { useContext } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { ActionPendingContext } from "./action-form";

type Props = React.ComponentProps<typeof Button> & { pendingText?: string };

/** Submit button that disables itself while the parent form is submitting. */
export function SubmitButton({ children, pendingText, ...props }: Props) {
  const status = useFormStatus();
  const transitionPending = useContext(ActionPendingContext);
  const pending = status.pending || transitionPending;
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
