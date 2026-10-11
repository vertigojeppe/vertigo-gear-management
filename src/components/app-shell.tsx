import type { Actor } from "@/lib/auth/session";
import { appConfig } from "../../config/app.config";
import { Sidebar } from "./sidebar";
import { MobileTabBar, MobileTopBar } from "./mobile-nav";

/**
 * Application frame.
 * Desktop (md+): left sidebar + content.
 * Phone: slim top bar, content, fixed bottom tab bar with a "More" sheet.
 * Navigation items live in ./navigation.ts.
 */
export function AppShell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <Sidebar actor={actor} appName={appConfig.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar appName={appConfig.name} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:px-8 md:py-8">{children}</main>
        <MobileTabBar actor={actor} />
      </div>
    </div>
  );
}
