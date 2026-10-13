"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISSED_KEY = "pwa-install-dismissed";

/** "ios" when this is Safari on an iPhone/iPad and the app is neither installed nor dismissed; otherwise "none". Server: "none". */
function iosCandidate(): "ios" | "none" {
  try {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(DISMISSED_KEY)) return "none";
  } catch {
    return "none";
  }
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua) ? "ios" : "none";
}
const noSubscribe = () => () => {};

/**
 * "Add to Home Screen" nudge on phones. Android fires beforeinstallprompt
 * and gets an Install button; iOS has no prompt API, so Safari users get
 * the two taps spelled out. Hidden once installed or dismissed.
 */
export function InstallHint() {
  const t = useTranslations("pwa");
  const ios = useSyncExternalStore(noSubscribe, iosCandidate, () => "none" as const);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      try {
        if (localStorage.getItem(DISMISSED_KEY)) return;
      } catch {
        /* private mode: show it anyway */
      }
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const mode = dismissed ? "hidden" : prompt ? "android" : ios === "ios" ? "ios" : "hidden";
  if (mode === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* private mode: the hint simply comes back next time */
    }
    setDismissed(true);
  };
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
  };

  return (
    <div role="status" className="flex items-center gap-3 border-b bg-accent/40 px-4 py-2 text-sm md:hidden">
      <Download className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{mode === "ios" ? t("iosHint") : t("androidHint")}</span>
      {mode === "android" && (
        <Button size="xs" onClick={install}>
          {t("install")}
        </Button>
      )}
      <button type="button" onClick={dismiss} aria-label={t("dismiss")} className="rounded p-1 text-muted-foreground hover:text-foreground">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
