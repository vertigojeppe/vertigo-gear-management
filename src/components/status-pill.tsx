import { cn } from "cn";

const COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  gray: "bg-muted text-muted-foreground",
};

/** Generic coloured pill (project / rental statuses, flags). */
export function StatusPill({ color, children, className, title }: { color: string; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", COLORS[color] ?? COLORS.gray, className)}>
      {children}
    </span>
  );
}
