/**
 * This tab's in-app page history (paths, with the scroll position each was
 * left at), kept in sessionStorage by the app shell's ScrollContainer.
 * "Back" uses the browser's back only when the page before is one of ours,
 * and going back puts the list where it was scrolled to. Pure.
 */
export type NavEntry = { path: string; top: number; /** path + search as it was left (a list's search and filters). */ url?: string };

export const NAV_STACK_KEY = "navStack";

/**
 * The stack after arriving at `path`. `history` = the browser's back / forward (popstate): arriving at the page
 * before is a back step (popped). A followed link always pushes, even to the page before. Same page = nothing.
 */
export function nextStack(stack: NavEntry[], path: string, history = false, max = 50): { stack: NavEntry[]; back: boolean } {
  if (stack.at(-1)?.path === path) return { stack, back: false };
  if (history && stack.at(-2)?.path === path) return { stack: stack.slice(0, -1), back: true };
  return { stack: [...stack, { path, top: 0 }].slice(-max), back: false };
}

/** Where a breadcrumb to `href` goes: that page as it was last left in this tab (with its search), else `href`. */
export function rememberedUrl(stack: NavEntry[], href: string): string {
  return stack.findLast((e) => e.path === href)?.url ?? href;
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
