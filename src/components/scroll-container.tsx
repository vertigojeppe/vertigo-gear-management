"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { nextStack, readStack, writeStack } from "@/lib/nav-stack";

/**
 * The scrolling region of the app shell. Because the window itself does not
 * scroll, we reset to the top when the route changes (what a full page load
 * would have done), except on a step back to the page before, which gets
 * the scroll position it was left at. It also keeps the tab's page history
 * that the Back link reads (src/lib/nav-stack.ts).
 */
export function ScrollContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // Set by the browser's back / forward, so only those count as a step back (a followed link to the page before does not).
  // The path it went to, so a back / forward that only changed the search cannot mark a later link as one.
  const popped = useRef<string | null>(null);
  useEffect(() => {
    const onPop = () => (popped.current = location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const { stack, back } = nextStack(readStack(), pathname, popped.current === pathname);
    popped.current = null;
    writeStack(stack);
    ref.current?.scrollTo({ top: back ? stack.at(-1)!.top : 0 });
  }, [pathname]);
  return (
    <div
      ref={ref}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      // Remember where this page was scrolled to and its search as a link is followed (capture: before the link navigates).
      onClickCapture={(e) => {
        if (!(e.target as HTMLElement).closest("a[href]") || !ref.current) return;
        const stack = readStack();
        if (stack.length > 0) writeStack([...stack.slice(0, -1), { ...stack.at(-1)!, top: ref.current.scrollTop, url: location.pathname + location.search }]);
      }}
    >
      {children}
    </div>
  );
}
