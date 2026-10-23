import { cache } from "react";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { LAYOUTS, type Layout } from "../../../config/app.config";
import { SettingsError } from "./service";

const isLayout = (v: unknown): v is Layout => LAYOUTS.includes(v as Layout);

/**
 * App-wide settings an admin changes in the app, stored as `AppSetting`
 * rows (key → JSON value). A missing row means the default.
 */
export const appSettings = {
  /** Page layout for everyone; "roomy" unless an admin chose "compact". Read once per request. */
  layout: cache(async (): Promise<Layout> => {
    const row = await prisma.appSetting.findUnique({ where: { key: "layout" } });
    return isLayout(row?.value) ? row.value : "roomy";
  }),

  async setLayout(actor: Actor, layout: string): Promise<Layout> {
    assertCan(actor, "settings.manage");
    if (!isLayout(layout)) throw new SettingsError("Choose a layout.", "layout");
    await prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({ where: { key: "layout" }, create: { key: "layout", value: layout }, update: { value: layout } });
      await logActivity(actor, { entityType: "settings", entityId: "layout", action: "layout_changed", summary: `Changed the page layout to ${layout}` }, tx);
    });
    return layout;
  },
};
