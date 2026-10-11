import { useTranslations } from "next-intl";
import { cn } from "cn";
import { itemStatus } from "../../config/app.config";

const COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  gray: "bg-muted text-muted-foreground",
};

/** Coloured pill for an item status. Colours come from config. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useTranslations("itemStatus");
  const def = itemStatus(status);
  const color = COLORS[def?.color ?? "gray"] ?? COLORS.gray;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", color, className)}>
      {def ? t(def.key) : status}
    </span>
  );
}
