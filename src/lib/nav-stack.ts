/**
 * This tab's in-app page history (paths, with the scroll position each was
 * left at), kept in sessionStorage by the app shell's ScrollContainer.
 * "Back" uses the browser's back only when the page before is one of ours,
 * and going back puts the list where it was scrolled to. Pure.
 */
export type NavEntry = { path: string; top: number };

export const NAV_STACK_KEY = "navStack";

/** The stack after arriving at `path`: the page before it = a back step (popped), the same page = nothing, else pushed. */
export function nextStack(stack: NavEntry[], path: string, max = 50): { stack: NavEntry[]; back: boolean } {
  if (stack.at(-1)?.path === path) return { stack, back: false };
  if (stack.at(-2)?.path === path) return { stack: stack.slice(0, -1), back: true };
  return { stack: [...stack, { path, top: 0 }].slice(-max), back: false };
}

export function readStack(): NavEntry[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(NAV_STACK_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function writeStack(stack: NavEntry[]) {
  try {
    sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
  } catch {
    // private mode or storage blocked: Back falls back to the parent link
  }
}
