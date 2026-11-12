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
  useEffect(() => {
    const { stack, back } = nextStack(readStack(), pathname);
    writeStack(stack);
    ref.current?.scrollTo({ top: back ? stack.at(-1)!.top : 0 });
  }, [pathname]);
  return (
    <div
      ref={ref}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      // Remember where this page was scrolled to as a link is followed (capture: before the link navigates).
      onClickCapture={(e) => {
        if (!(e.target as HTMLElement).closest("a[href]") || !ref.current) return;
        const stack = readStack();
        if (stack.length > 0) writeStack([...stack.slice(0, -1), { ...stack.at(-1)!, top: ref.current.scrollTop }]);
      }}
    >
      {children}
    </div>
  );
}
