import { cache } from "react";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { CALL_HOURS, LAYOUTS, type Layout } from "../../../config/app.config";
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

  /** Hours a build-up / pack-down calendar event lasts from its call time (Settings › Calendar). */
  callHours: cache(async (): Promise<number> => {
    const row = await prisma.appSetting.findUnique({ where: { key: "calendarCallHours" } });
    const v = Number(row?.value);
    return Number.isFinite(v) && v >= CALL_HOURS.min && v <= CALL_HOURS.max ? v : CALL_HOURS.default;
  }),

  /** "2", "1,5" or "1.5"; half hours from `CALL_HOURS.min` to `max`. */
  async setCallHours(actor: Actor, raw: string): Promise<number> {
    assertCan(actor, "settings.manage");
    const hours = Number(raw.trim().replace(",", "."));
    if (!raw.trim() || !Number.isFinite(hours) || hours < CALL_HOURS.min || hours > CALL_HOURS.max || !Number.isInteger(hours * 2)) {
      throw new SettingsError(`Enter a length between ${CALL_HOURS.min} and ${CALL_HOURS.max} hours, in half hours.`, "callHours");
    }
    await prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({ where: { key: "calendarCallHours" }, create: { key: "calendarCallHours", value: hours }, update: { value: hours } });
      await logActivity(actor, { entityType: "settings", entityId: "calendar", action: "call_hours_changed", summary: `Build-up and pack-down calendar events now last ${hours} h` }, tx);
    });
    return hours;
  },
};
