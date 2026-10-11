"use server";

import { revalidatePath } from "next/cache";
import { requireActor, requirePermission } from "@/lib/auth/session";
import { processOutbox } from "@/lib/outbox";
import { feedTokens, type FeedScope } from "./feeds";
import { registerCalendarHandlers } from "./handlers";

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
