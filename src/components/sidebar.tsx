"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { cn } from "cn";
import { NAV_ITEMS, isActive } from "./navigation";
import { signOutAction } from "@/app/(app)/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Actor } from "@/lib/auth/session";

/** Desktop navigation. Hidden below the md breakpoint. */
export function Sidebar({ actor, appName }: { actor: Actor; appName: string }) {
  const pathname = usePathname();
  const t = useTranslations();
  const groups: { key: "main" | "tools"; label?: string }[] = [
    { key: "main" },
    { key: "tools", label: t("nav.tools") },
  ];

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r bg-card md:flex">
      <div className="px-5 py-4">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          {appName}
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-4 px-3" aria-label="Main">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-0.5">
            {group.label && (
              <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
            )}
            {NAV_ITEMS.filter((i) => i.group === group.key).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                  {t(`nav.${item.key}`)}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t px-4 pt-3">
        <ThemeToggle compact className="w-full justify-between" />
      </div>
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {initials(actor.name)}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm">{actor.name}</p>
          <p className="truncate text-xs text-muted-foreground">{t(`roles.${actor.role}`)}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("common.signOut")}
            title={t("common.signOut")}
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </aside>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
