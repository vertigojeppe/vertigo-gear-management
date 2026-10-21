import { describe, expect, it } from "vitest";
import { fromAcceptLanguage, isLocale, pickLocale } from "../locale";

describe("language choice", () => {
  it("reads the browser's preferred supported language", () => {
    expect(fromAcceptLanguage("da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("da");
    expect(fromAcceptLanguage("de-DE,de;q=0.9,en;q=0.5")).toBe("en");
    expect(fromAcceptLanguage("en;q=0.4, da;q=0.8")).toBe("da");
    expect(fromAcceptLanguage("fr,de")).toBeNull();
    expect(fromAcceptLanguage(null)).toBeNull();
  });

  it("prefers the user's saved choice, then the cookie, then the browser", () => {
    expect(pickLocale({ user: "en", cookie: "da", acceptLanguage: "da" })).toBe("en");
    expect(pickLocale({ user: null, cookie: "da", acceptLanguage: "en" })).toBe("da");
    expect(pickLocale({ user: "xx", cookie: "yy", acceptLanguage: "da-DK" })).toBe("da");
    expect(pickLocale({})).toBe("en");
    expect(isLocale("da")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });
});
