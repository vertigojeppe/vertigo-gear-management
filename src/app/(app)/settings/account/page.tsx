import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireActor } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { apiTokens, twoFactor } from "@/modules/users";
import { feedTokens } from "@/modules/calendar";
import { FeedRow } from "../calendar/forms";
import { ApiTokenForm, ChangePasswordForm, RevokeTokenButton } from "./forms";
import { TwoFactorSection } from "./two-factor-forms";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const actor = await requireActor();
  const t = await getTranslations("settings");
  const tr = await getTranslations("roles");
  const tcal = await getTranslations("calendar");
  const tokens = await apiTokens.listFor(actor.id);
  const mine = await feedTokens.ensure("mine", actor.id);
  const tf = await twoFactor.status(actor.id);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("account")}
        subtitle={
          <>
            {actor.name} · {actor.email} · <Badge variant="secondary">{tr(actor.role)}</Badge>
          </>
        }
        crumbs={[{ label: t("title"), href: "/settings" }, { label: t("account") }]}
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("changePassword")}</h2>
        <ChangePasswordForm />
      </section>
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">{t("twoFactor")}</h2>
          <p className="text-sm text-muted-foreground">{t("twoFactorHelp")}</p>
        </div>
        <TwoFactorSection enabled={tf.enabled} since={tf.enabledAt ? formatDateTime(tf.enabledAt) : null} recoveryLeft={tf.recoveryLeft} required={tf.required} />
      </section>
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">{tcal("feeds")}</h2>
          <p className="text-sm text-muted-foreground">{tcal("feedsHelp")}</p>
        </div>
        <ul className="divide-y rounded-md border text-sm">
          <FeedRow label={tcal("feedMine")} scope="mine" path={feedTokens.url(mine.token, "")} />
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">{t("apiTokens")}</h2>
          <p className="text-sm text-muted-foreground">{t("apiTokensHelp")}</p>
        </div>
        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTokens")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {tokens.map((tok) => (
              <li key={tok.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{tok.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    <span className="font-mono">{tok.prefix}…</span> · {t("lastUsed")}: {tok.lastUsedAt ? formatDateTime(tok.lastUsedAt) : t("never")}
                  </span>
                </span>
                <RevokeTokenButton id={tok.id} />
              </li>
            ))}
          </ul>
        )}
        <ApiTokenForm />
      </section>
    </div>
  );
}
