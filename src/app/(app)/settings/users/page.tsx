import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { users } from "@/modules/users";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  await requirePermission("users.manage");
  const t = await getTranslations("settings");
  const tr = await getTranslations("roles");
  const rows = await users.list();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("users")}
        subtitle={t("usersHelp")}
        crumbs={[{ label: t("title"), href: "/settings" }, { label: t("users") }]}
        actions={
          <Link href="/settings/users/new" className={buttonVariants()}>
            {t("newUser")}
          </Link>
        }
      />
      <ul className="divide-y rounded-md border text-sm">
        {rows.map((u) => (
          <li key={u.id}>
            <Link href={`/settings/users/${u.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{u.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
              </span>
              {!u.active && <Badge variant="outline">{t("inactive")}</Badge>}
              <Badge variant="secondary">{tr(u.role)}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
