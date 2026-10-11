import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/**
 * Label + control + help text + error, in a consistent layout.
 * Pass the input as children with the same `id` as given here.
 */
export function Field({
  id,
  label,
  help,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-800 dark:text-green-300">{message}</p>;
}
