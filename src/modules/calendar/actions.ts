"use server";

import { revalidatePath } from "next/cache";
import { requireActor, requirePermission } from "@/lib/auth/session";
import { processOutbox } from "@/lib/outbox";
import { echoValues, errorState, type FormState } from "@/lib/forms";
// eslint-disable-next-line no-restricted-imports -- one setting from the settings module, not its barrel
import { appSettings } from "@/modules/settings/app-settings";
import { feedTokens, type FeedScope } from "./feeds";
import { registerCalendarHandlers } from "./handlers";
import { queueAllEntrySyncs, queueAllProjectSyncs } from "./sync";

export async function rotateFeedToken(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const scope = String(formData.get("scope")) as FeedScope;
  if (scope !== "mine") await requirePermission("settings.manage");
  await feedTokens.rotate(scope, actor.id);
  revalidatePath("/settings/calendar");
  revalidatePath("/settings/account");
}

/** Runs the outbox now (webhooks + calendar sync) instead of waiting for the poller. */
export async function runOutboxNow(): Promise<void> {
  await requirePermission("settings.manage");
  registerCalendarHandlers();
  await processOutbox(50);
  revalidatePath("/settings/webhooks");
  revalidatePath("/settings/calendar");
}

/** Settings › Calendar: how long build-up / pack-down events last. Every project is re-synced to Google with it. */
export async function saveCallHours(_prev: FormState<{ hours: number }>, formData: FormData): Promise<FormState<{ hours: number }>> {
  const actor = await requirePermission("settings.manage");
  try {
    const hours = await appSettings.setCallHours(actor, String(formData.get("callHours") ?? ""));
    await queueAllProjectSyncs();
    revalidatePath("/settings/calendar");
    return { ok: true, data: { hours } };
  } catch (err) {
    const { error, fieldErrors, values } = errorState(err, echoValues(formData));
    return { ok: false, error, fieldErrors, values };
  }
}

/** Settings › Calendar: send calendar entries as invitations from people's own calendars (needs domain-wide delegation). */
export async function saveCalendarInvites(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("settings.manage");
  try {
    await appSettings.setCalendarInvites(actor, formData.get("invites") === "on");
    // Entries that have not ended move to (or from) people's own calendars.
    await queueAllEntrySyncs();
    revalidatePath("/settings/calendar");
    return { ok: true };
  } catch (err) {
    return errorState(err);
  }
}
