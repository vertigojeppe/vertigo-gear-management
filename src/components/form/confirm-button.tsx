"use client";

import { Button } from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button> & { confirm: string };

/** Submit button that asks for confirmation first. Use for deletes. */
export function ConfirmButton({ confirm, children, onClick, ...props }: Props) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    >
      {children}
    </Button>
  );
}
