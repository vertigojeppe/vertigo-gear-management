"use client";

import { useState } from "react";
import { cn } from "cn";

type Props = React.ComponentProps<"select">;

/**
 * Plain <select> styled like the shadcn input, posting with FormData.
 *
 * When used uncontrolled (`defaultValue`), it keeps the chosen value in
 * state. React 19 resets a form's fields after a server action completes;
 * a native select would snap back to its first option, so a user who got a
 * validation or conflict message would lose their choice. Inputs survive
 * that reset because React re-applies their defaultValue; selects need this.
 */
export function NativeSelect({ className, defaultValue, value, onChange, ...props }: Props) {
  const controlled = value !== undefined;
  const initial = defaultValue === undefined ? "" : String(defaultValue);
  const [val, setVal] = useState(initial);
  const [prevDefault, setPrevDefault] = useState(initial);
  if (!controlled && prevDefault !== initial) {
    // defaultValue changed (e.g. the action echoed the submitted values).
    setPrevDefault(initial);
    setVal(initial);
  }
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30",
        className,
      )}
      value={controlled ? value : val}
      onChange={(e) => {
        if (!controlled) setVal(e.target.value);
        onChange?.(e);
      }}
      {...props}
    />
  );
}
