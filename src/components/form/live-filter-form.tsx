"use client";

import { useEffect, useRef, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "cn";

/**
 * A GET filter form that applies itself: dropdowns and checkboxes at once,
 * typing (search boxes, dates) after a short pause. The URL stays the
 * source of truth (shareable, back button works); the server page re-renders
 * with the new search params while the inputs keep focus and what was typed.
 *
 * Without JavaScript it is a plain GET form, so keep a submit button inside
 * and give it `group-data-[live]:hidden` to hide it once the form is live.
 * Empty fields are left out of the URL, and the page number is dropped so a
 * new search starts on page 1.
 */
const noSubscribe = () => () => {};

export function LiveFilterForm({ children, className, action, debounceMs = 300 }: { children: React.ReactNode; className?: string; action?: string; debounceMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  // True only in the browser after hydration, so the fallback button stays for anyone without JavaScript.
  const live = useSyncExternalStore(noSubscribe, () => true, () => false);
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The query this form last navigated to, to tell our own navigations from Clear links and the back button.
   * Starts at the page's own query: the server already rendered those values, and syncing on hydration would wipe what was typed before it.
   */
  const lastQuery = useRef<string | null>(searchParams.toString());

  const query = () => {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(formRef.current!)) if (typeof v === "string" && v.trim() !== "") params.append(k, v);
    return params.toString();
  };

  const navigate = () => {
    if (timer.current) clearTimeout(timer.current);
    const qs = query();
    if (qs === searchParams.toString()) return;
    lastQuery.current = qs;
    const target = action ?? pathname;
    startTransition(() => router.replace(qs ? `${target}?${qs}` : target, { scroll: false }));
  };

  // A navigation that did not come from typing here (Clear, back/forward, a link): show its values in the fields.
  useEffect(() => {
    const current = searchParams.toString();
    if (current === lastQuery.current || !formRef.current) return;
    lastQuery.current = current;
    for (const el of Array.from(formRef.current.elements)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || !el.name || el.type === "hidden" || el.type === "submit") continue;
      if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = searchParams.getAll(el.name).includes(el.value);
      else el.value = searchParams.get(el.name) ?? "";
    }
  }, [searchParams]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const onChange = (e: React.FormEvent<HTMLFormElement>) => {
    const el = e.target as HTMLElement;
    const immediate = el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio"));
    if (timer.current) clearTimeout(timer.current);
    if (immediate) navigate();
    else timer.current = setTimeout(navigate, debounceMs);
  };

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      data-live={live ? "" : undefined}
      aria-busy={pending}
      className={cn("group", className)}
      onChange={onChange}
      onSubmit={(e) => {
        e.preventDefault();
        navigate();
      }}
    >
      {children}
    </form>
  );
}
