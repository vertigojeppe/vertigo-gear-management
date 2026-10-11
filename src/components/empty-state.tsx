import type { ReactNode } from "react";

/**
 * Standard empty state. Every list page uses this when there is nothing to
 * show, with a one-line explanation and (optionally) the primary action.
 */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-md text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
