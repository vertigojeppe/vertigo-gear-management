import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Actor } from "@/lib/auth/session";
import { signOutAction } from "@/app/(app)/actions";
import { appConfig } from "../../config/app.config";

/**
 * Navigation items. `href: null` marks sections that arrive in a later phase;
 * they render as muted text so the layout is stable from day one.
 */
const NAV: { key: "dashboard" | "inventory" | "projects" | "rentals" | "settings"; href: string | null }[] = [
  { key: "dashboard", href: "/dashboard" },
  { key: "inventory", href: null },
  { key: "projects", href: null },
  { key: "rentals", href: null },
  { key: "settings", href: null },
];

export async function AppShell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            {appConfig.name}
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            {NAV.map((item) =>
              item.href ? (
                <Link
                  key={item.key}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              ) : (
                <span key={item.key} className="px-3 py-1.5 text-sm text-muted-foreground/60" aria-disabled>
                  {t(`nav.${item.key}`)}
                </span>
              ),
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{actor.name}</span>
            <Badge variant="secondary">{t(`roles.${actor.role}`)}</Badge>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                {t("common.signOut")}
              </Button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 sm:hidden" aria-label="Main (mobile)">
          {NAV.map((item) =>
            item.href ? (
              <Link key={item.key} href={item.href} className="rounded-md px-3 py-1.5 text-sm hover:bg-muted">
                {t(`nav.${item.key}`)}
              </Link>
            ) : (
              <span key={item.key} className="px-3 py-1.5 text-sm text-muted-foreground/60">
                {t(`nav.${item.key}`)}
              </span>
            ),
          )}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
