import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: { searchParams: Promise<{ next?: string; stale?: string }> }) {
  const t = await getTranslations("auth");
  const { next, stale } = await props.searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {stale && (
            <p role="status" className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              {t("stale")}
            </p>
          )}
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
