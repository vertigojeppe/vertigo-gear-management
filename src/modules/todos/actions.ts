"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth/session";
import { todos } from "./service";

// Plain form actions: the form resets after adding, which is what a to-do box wants.
// An empty line is simply ignored (the input is `required`, so only no-JS posts get here).

export async function addTodo(formData: FormData) {
  const actor = await requireActor();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  await todos.add(actor, text.slice(0, 500));
  revalidatePath("/dashboard");
}

export async function setTodoDone(formData: FormData) {
  const actor = await requireActor();
  await todos.setDone(actor, String(formData.get("id") ?? ""), formData.get("done") === "true");
  revalidatePath("/dashboard");
}

export async function removeTodo(formData: FormData) {
  const actor = await requireActor();
  await todos.remove(actor, String(formData.get("id") ?? ""));
  revalidatePath("/dashboard");
}
