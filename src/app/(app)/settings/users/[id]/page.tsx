import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActivityList } from "@/components/activity-list";
import { PageHeader } from "@/components/page-header";
import { activityFor } from "@/lib/activity";
import { requirePermission } from "@/lib/auth/session";
import { resetTwoFactor, users } from "@/modules/users";
import { ConfirmButton } from "@/components/form/confirm-button";
import { ResetPasswordForm, UserForm } from "../user-form";

export const metadata: Metadata = { title: "Edit user" };

export default async function EditUserPage(props: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("users.manage");
  const { id } = await props.params;
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const [user, activity] = await Promise.all([users.get(id), activityFor("user", id, 20)]);
  if (!user) notFound();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={user.name} subtitle={user.email} crumbs={[{ label: t("title"), href: "/settings" }, { label: t("users"), href: "/settings/users" }, { label: user.name }]} />
      <UserForm user={user} isSelf={user.id === actor.id} />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t("resetPassword")}</h2>
        <ResetPasswordForm userId={user.id} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t("twoFactor")}</h2>
        <p className="text-sm text-muted-foreground">{user.twoFactor ? t("twoFactorOnFor") : t("twoFactorOffFor")}</p>
        {user.twoFactor && (
          <form action={resetTwoFactor}>
            <input type="hidden" name="id" value={user.id} />
            <ConfirmButton confirm={t("twoFactorResetConfirm", { name: user.name })} variant="outline" size="sm">
              {t("twoFactorReset")}
            </ConfirmButton>
          </form>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{tc("activity")}</h2>
        <ActivityList rows={activity} />
      </section>
    </div>
  );
}
