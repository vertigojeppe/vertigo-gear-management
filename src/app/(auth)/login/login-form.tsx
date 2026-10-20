"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/form/action-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      {/* Step two keeps email and password in the form (hidden) and asks for the code. */}
      <div className="flex flex-col gap-2" hidden={state.needCode}>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div className="flex flex-col gap-2" hidden={state.needCode}>
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.needCode && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">{t("code")}</Label>
          <Input id="code" name="code" autoComplete="one-time-code" inputMode="text" autoCapitalize="none" spellCheck={false} required autoFocus />
          <p className="text-xs text-muted-foreground">{t("codeHelp")}</p>
        </div>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error === "rateLimited" ? t("rateLimited", { minutes: state.retryMinutes ?? 15 }) : t(state.error)}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {t("submit")}
      </Button>
    </ActionForm>
  );
}
