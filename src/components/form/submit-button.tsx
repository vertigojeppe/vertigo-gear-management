"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button> & { pendingText?: string };

/** Submit button that disables itself while the parent form is submitting. */
export function SubmitButton({ children, pendingText, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
