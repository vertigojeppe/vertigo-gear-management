"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * The scrolling region of the app shell. Because the window itself does not
 * scroll, we reset to the top when the route changes (what a full page load
 * would have done).
 */
export function ScrollContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [pathname]);
  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {children}
    </div>
  );
}
