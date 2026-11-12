"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { readStack, rememberedUrl } from "@/lib/nav-stack";

/** A breadcrumb that opens its page as it was last left in this tab, e.g. Inventory with its search and filters. */
export function CrumbLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className="hover:underline"
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const url = rememberedUrl(readStack(), href);
        if (url === href) return;
        e.preventDefault();
        router.push(url);
      }}
    >
      {children}
    </Link>
  );
}
