"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "cn";
import { appConfig } from "../../config/app.config";
import { setLanguage } from "@/modules/users/actions";

/**
 * English / Danish switch. Signed in, the choice is saved on the user and
 * follows them to every device; signed out (the sign-in page) it is kept in
 * a cookie for this browser. Short codes when compact (sidebar).
 */
export function LanguageToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations("language");
  const current = useLocale();
  const [pending, start] = useTransition();
  return (
    <div role="radiogroup" aria-label={t("label")} aria-busy={pending} className={cn("inline-flex rounded-md border p-0.5", pending && "opacity-60", className)}>
      {appConfig.locales.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          lang={l}
          aria-checked={current === l}
          aria-label={t(l)}
          title={t(l)}
          disabled={pending}
          onClick={() => current !== l && start(() => setLanguage(l))}
          className={cn("rounded px-2 py-1 text-xs uppercase transition-colors", !compact && "flex-1 normal-case", current === l ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {compact ? l : t(l)}
        </button>
      ))}
    </div>
  );
}
