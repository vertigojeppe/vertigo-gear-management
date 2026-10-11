import { getRequestConfig } from "next-intl/server";
import { appConfig } from "../../config/app.config";

// Single-locale setup for now: the UI is English, and every string lives in
// messages/<locale>.json so a Danish translation is a file, not a refactor.
// To switch locale per user later, read it from the session here.
export default getRequestConfig(async () => {
  const locale = appConfig.defaultLocale;
  return {
    locale,
    timeZone: appConfig.timezone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
