import { appConfig, type Locale } from "../../config/app.config";

/**
 * Which language a request gets, first match wins:
 * 1. the signed-in user's saved choice (follows them to every device),
 * 2. the `locale` cookie (the switch on the sign-in page, or a browser
 *    that switched while signed out),
 * 3. the browser's Accept-Language,
 * 4. appConfig.defaultLocale.
 * Pure; src/i18n/request.ts feeds it.
 */
export const LOCALE_COOKIE = "locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (appConfig.locales as readonly string[]).includes(v);
}

/** The best supported language in an Accept-Language header ("da-DK,da;q=0.9,en;q=0.8" → "da"). */
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1, i };
    })
    .filter((x) => x.lang && !Number.isNaN(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  return ranked.map((x) => x.lang).find(isLocale) ?? null;
}

export function pickLocale(input: { user?: string | null; cookie?: string | null; acceptLanguage?: string | null }): Locale {
  if (isLocale(input.user)) return input.user;
  if (isLocale(input.cookie)) return input.cookie;
  return fromAcceptLanguage(input.acceptLanguage) ?? appConfig.defaultLocale;
}
