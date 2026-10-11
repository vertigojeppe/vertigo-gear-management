"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "cn";

const TABS = [
  { key: "models", href: "/inventory" },
  { key: "items", href: "/inventory/items" },
  { key: "categories", href: "/inventory/categories" },
  { key: "locations", href: "/inventory/locations" },
] as const;

/** Sub-navigation shared by the inventory list pages. */
export function InventoryTabs() {
  const pathname = usePathname();
  const t = useTranslations("inventory");
  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Inventory sections">
      {TABS.map((tab) => {
        const active = tab.href === "/inventory" ? pathname === "/inventory" || pathname.startsWith("/inventory/models") : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
