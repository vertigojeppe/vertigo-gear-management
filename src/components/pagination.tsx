import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

/** Previous/next links that keep the current search params. */
export async function Pagination({
  page,
  pages,
  total,
  params,
}: {
  page: number;
  pages: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const t = await getTranslations("common");
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {t("results", { count: total })}
        {pages > 1 && <> · {t("page", { page, pages })}</>}
      </span>
      {pages > 1 && (
        <div className="flex gap-2">
          <Link
            href={href(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}
          >
            {t("previous")}
          </Link>
          <Link
            href={href(Math.min(pages, page + 1))}
            aria-disabled={page >= pages}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-50")}
          >
            {t("next")}
          </Link>
        </div>
      )}
    </div>
  );
}
