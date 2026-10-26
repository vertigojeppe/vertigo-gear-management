/**
 * The board's light / dark choice (BoardThemeToggle): the localStorage key,
 * and the inline script for the top of the board page. Plain module (no
 * "use client"), so the server page can build the script.
 */
export type BoardTheme = "light" | "dark";
export const BOARD_THEME_KEY = "boardTheme";

/**
 * Inline script for the top of the board page: applies the board's theme
 * before the first paint, so a light screen never flashes dark. Keep in
 * step with `apply` in components/board-theme.tsx.
 */
export function boardThemeScript(fromUrl: BoardTheme | null): string {
  return `(function(){try{var u=${JSON.stringify(fromUrl)};if(u)localStorage.setItem("${BOARD_THEME_KEY}",u);var t=localStorage.getItem("${BOARD_THEME_KEY}")==="light"?"light":"dark";document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add("dark");}})();`;
}

