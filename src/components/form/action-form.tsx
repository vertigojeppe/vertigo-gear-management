"use client";

import { createContext, useTransition } from "react";

/**
 * Form for server actions driven by useActionState.
 *
 * It submits through a transition instead of `<form action>`. React 19
 * resets every field after a `<form action>` submission completes, which
 * wipes what the user typed when the action answers with a validation or
 * conflict message. Submitting manually keeps the fields as they are, so
 * the echoed values and the user's selections survive.
 *
 * SubmitButton reads the pending flag from context, since useFormStatus
 * does not see transition-based submits.
 */
export const ActionPendingContext = createContext(false);

type Props = Omit<React.ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (formData: FormData) => void;
};

export function ActionForm({ action, children, ...props }: Props) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <ActionPendingContext.Provider value={pending}>{children}</ActionPendingContext.Provider>
    </form>
  );
}
