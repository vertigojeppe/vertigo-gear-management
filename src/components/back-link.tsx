"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { readStack } from "@/lib/nav-stack";

/**
 * "← Back": the browser's back (the list comes back with its search,
 * filters and scroll position) when the page before is in the app in this
 * tab, otherwise a plain link to the parent page (opened from a QR code,
 * a shared link or a new tab).
 */
export function BackLink({ href }: { href: string }) {
  const router = useRouter();
  const t = useTranslations("common");
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium text-foreground hover:bg-muted"
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || readStack().length < 2) return;
        e.preventDefault();
        router.back();
      }}
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      {t("back")}
    </Link>
  );
}
