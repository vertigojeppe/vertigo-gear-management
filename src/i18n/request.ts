import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { appConfig } from "../../config/app.config";
import { currentUserLocale } from "@/lib/auth/session";
import { LOCALE_COOKIE, pickLocale } from "@/lib/locale";

// Per-request language without locale URLs: the user's saved choice, else
// the cookie, else the browser (src/lib/locale.ts). Every string lives in
// messages/<locale>.json; the switch is LanguageToggle.
export default getRequestConfig(async () => {
  const [user, cookieStore, h] = await Promise.all([currentUserLocale(), cookies(), headers()]);
  const locale = pickLocale({ user, cookie: cookieStore.get(LOCALE_COOKIE)?.value, acceptLanguage: h.get("accept-language") });
  return {
    locale,
    timeZone: appConfig.timezone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
