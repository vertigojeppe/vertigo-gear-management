"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Field, FormError, FormSuccess } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";
import { ROLE_KEYS } from "../../../../../config/app.config";
import type { PublicUser } from "@/modules/users";
import { createUser, resetUserPassword, updateUser } from "@/modules/users/actions";

export function UserForm({ user, isSelf }: { user?: PublicUser; isSelf?: boolean }) {
  const t = useTranslations("settings");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(user ? updateUser : createUser, {});
  const v = (name: string, fallback: string | null | undefined) => (state.values && name in state.values ? state.values[name] : (fallback ?? ""));
  const err = state.fieldErrors ?? {};
  const active = state.values ? state.values.active === "on" : (user?.active ?? true);

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      {user && <input type="hidden" name="id" value={user.id} />}
      <FormError message={state.error} />
      <FormSuccess message={state.ok && user ? tc("saved") : undefined} />
      <Field id="name" label={t("name")} error={err.name}>
        <Input id="name" name="name" defaultValue={v("name", user?.name)} required autoFocus={!user} />
      </Field>
      <Field id="email" label={t("email")} error={err.email}>
        <Input id="email" name="email" type="email" defaultValue={v("email", user?.email)} required />
      </Field>
      <Field id="role" label={t("role")} help={t("roleHelp")} error={err.role}>
        <NativeSelect id="role" name="role" defaultValue={v("role", user?.role ?? "member")} disabled={isSelf}>
          {ROLE_KEYS.map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </NativeSelect>
        {isSelf && <input type="hidden" name="role" value={user?.role} />}
      </Field>
      <Field id="phone" label={t("phone")} optional error={err.phone}>
        <Input id="phone" name="phone" type="tel" defaultValue={v("phone", user?.phone)} />
      </Field>
      <Field id="googleEmail" label={t("googleEmail")} optional help={t("googleEmailHelp")} error={err.googleEmail}>
        <Input id="googleEmail" name="googleEmail" type="email" defaultValue={v("googleEmail", user?.googleEmail)} />
      </Field>
      {!user && (
        <Field id="password" label={t("password")} help={t("passwordHelp")} error={err.password}>
          <Input id="password" name="password" type="text" autoComplete="off" required minLength={8} />
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" className="size-4" defaultChecked={active} disabled={isSelf} />
        {t("active")}
        <span className="text-xs text-muted-foreground">{t("activeHelp")}</span>
      </label>
      {isSelf && <input type="hidden" name="active" value="on" />}
      <div className="flex gap-2">
        <SubmitButton pendingText={tc("loading")}>{user ? tc("save") : tc("create")}</SubmitButton>
        <Link href="/settings/users" className={buttonVariants({ variant: "outline" })}>
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(resetUserPassword, {});
  return (
    <form action={action} className="flex max-w-lg flex-col gap-3">
      <input type="hidden" name="id" value={userId} />
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? t("passwordReset") : undefined} />
      <Field id="newPassword" label={t("newPassword")} help={t("passwordHelp")} error={state.fieldErrors?.password}>
        <Input id="newPassword" name="password" type="text" autoComplete="off" required minLength={8} />
      </Field>
      <div>
        <SubmitButton variant="outline" pendingText={tc("loading")}>
          {t("resetPassword")}
        </SubmitButton>
      </div>
    </form>
  );
}
