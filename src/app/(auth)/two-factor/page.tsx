import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActorForTwoFactorSetup } from "@/lib/auth/session";
import { twoFactor } from "@/modules/users";
import { signOutAction } from "@/app/(app)/actions";
import { TwoFactorSetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Two-factor sign-in" };

/**
 * Set up two-factor sign-in: scan the QR code (or type the key) into an
 * authenticator app and confirm with its first code. Outside the app shell,
 * because users whose role requires 2FA land here before they can use
 * anything else. Every load makes a new secret; nothing is stored until
 * the code matches.
 */
export default async function TwoFactorSetupPage() {
  const { actor, required } = await requireActorForTwoFactorSetup();
  const t = await getTranslations("twoFactor");
  if ((await twoFactor.status(actor.id)).enabled) redirect("/settings/account");
  const setup = twoFactor.begin(actor);
  const qr = await QRCode.toDataURL(setup.url, { margin: 1, width: 220, errorCorrectionLevel: "M" });
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>{t("title")}</h1>
          </CardTitle>
          <CardDescription>{required ? t("requiredIntro") : t("intro")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            <li>{t("step1")}</li>
            <li>{t("step2")}</li>
            <li>{t("step3")}</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL made on the server */}
          <img src={qr} alt={t("qrAlt")} width={220} height={220} className="mx-auto rounded-md bg-white p-2" />
          <div className="text-sm">
            <p className="text-muted-foreground">{t("manualKey")}</p>
            <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs" data-testid="totp-secret">
              {setup.secret.match(/.{1,4}/g)?.join(" ")}
            </code>
          </div>
          <TwoFactorSetupForm sealed={setup.sealed} next={required ? "/dashboard" : "/settings/account"} />
          <form action={signOutAction} className="border-t pt-3">
            <button type="submit" className="text-sm text-muted-foreground underline">
              {t("signOut")}
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
