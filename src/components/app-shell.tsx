import type { Actor } from "@/lib/auth/session";
import { appConfig, type Layout } from "../../config/app.config";
import { Sidebar } from "./sidebar";
import { MobileTabBar, MobileTopBar } from "./mobile-nav";
import { ScrollContainer } from "./scroll-container";
import { InstallHint } from "./pwa/install-hint";

/**
 * Application frame.
 * Desktop (md+): left sidebar + content.
 * Phone: slim top bar, content, bottom tab bar with a "More" sheet.
 *
 * The frame is viewport-high and only the content area scrolls, so the
 * tab bar and sidebar never move and mobile browser chrome cannot cover
 * the tabs. Navigation items live in ./navigation.ts.
 *
 * `data-layout` is the admin's choice (Settings › Layout). With "roomy",
 * a page that marks its root with `data-wide` (the packing list) gets the
 * full width, and `roomy:` classes (globals.css) switch on its columns.
 */
export function AppShell({ actor, layout, children }: { actor: Actor; layout: Layout; children: React.ReactNode }) {
  return (
    <div data-layout={layout} className="flex h-dvh overflow-hidden">
      <Sidebar actor={actor} appName={appConfig.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar appName={appConfig.name} />
        <InstallHint />
        <ScrollContainer>
          <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8 roomy:has-[[data-wide]]:max-w-none">{children}</main>
        </ScrollContainer>
        <MobileTabBar actor={actor} />
      </div>
    </div>
  );
}
