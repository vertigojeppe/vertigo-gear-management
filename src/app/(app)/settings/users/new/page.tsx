import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: "New user" };

export default async function NewUserPage() {
  await requirePermission("users.manage");
  const t = await getTranslations("settings");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("newUser")} crumbs={[{ label: t("title"), href: "/settings" }, { label: t("users"), href: "/settings/users" }, { label: t("newUser") }]} />
      <UserForm />
    </div>
  );
}
