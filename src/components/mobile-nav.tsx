"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut, MoreHorizontal } from "lucide-react";
import { cn } from "cn";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MORE_ITEMS, NAV_ITEMS, TAB_ITEMS, isActive } from "./navigation";
import { signOutAction } from "@/app/(app)/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Actor } from "@/lib/auth/session";

/** Slim top bar for phones: current section title. Hidden from md up. */
export function MobileTopBar({ appName }: { appName: string }) {
  const pathname = usePathname();
  const t = useTranslations();
  const current = NAV_ITEMS.find((i) => isActive(pathname, i.href));
  return (
    <header className="flex h-12 shrink-0 items-center border-b bg-card px-4 md:hidden">
      <span className="font-semibold">{current ? t(`nav.${current.key}`) : appName}</span>
    </header>
  );
}

/** Bottom tab bar for phones with a "More" sheet for the remaining sections. */
export function MobileTabBar({ actor }: { actor: Actor }) {
  const pathname = usePathname();
  const t = useTranslations();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_ITEMS.some((i) => isActive(pathname, i.href));

  return (
    <>
      <nav
        className="grid shrink-0 grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        {TAB_ITEMS.map((item) => (
          <TabButton key={item.key} active={isActive(pathname, item.href)} label={t(`nav.${item.key}`)}>
            <Link href={item.href} className="flex flex-col items-center gap-0.5 py-2">
              <item.icon className="size-5" aria-hidden />
              <span className="text-[11px]">{t(`nav.${item.key}`)}</span>
            </Link>
          </TabButton>
        ))}
        <TabButton active={moreActive} label={t("nav.more")}>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex w-full flex-col items-center gap-0.5 py-2"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className="size-5" aria-hidden />
            <span className="text-[11px]">{t("nav.more")}</span>
          </button>
        </TabButton>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>{t("nav.more")}</SheetTitle>
            <SheetDescription>{t("common.signedInAs", { name: actor.name })}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col px-4">
            {MORE_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-3 text-base",
                  isActive(pathname, item.href) ? "bg-muted font-medium" : "hover:bg-muted",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {t(`nav.${item.key}`)}
              </Link>
            ))}
            <div className="mt-2 border-t px-2 pt-3">
              <ThemeToggle className="w-full justify-between" />
            </div>
            <form action={signOutAction} className="mt-2 border-t pt-2">
              <button type="submit" className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-base hover:bg-muted">
                <LogOut className="size-5" aria-hidden />
                {t("common.signOut")}
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TabButton({ active, label, children }: { active: boolean; label: string; children: React.ReactNode }) {
  return (
    <div
      aria-label={label}
      className={cn("text-center", active ? "text-foreground font-medium" : "text-muted-foreground")}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </div>
  );
}
