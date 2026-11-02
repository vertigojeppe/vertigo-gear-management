"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth/session";
import { todos } from "./service";

// Plain form actions: the form resets after adding, which is what a to-do box wants.
// An empty line is simply ignored (the input is `required`, so only no-JS posts get here).

const fields = (formData: FormData) => ({ text: String(formData.get("text") ?? "").slice(0, 500), category: String(formData.get("category") ?? "").slice(0, 60) });

export async function addTodo(formData: FormData) {
  const actor = await requireActor();
  if (!fields(formData).text.trim()) return;
  await todos.add(actor, fields(formData));
  revalidatePath("/dashboard");
}

export async function updateTodo(formData: FormData) {
  const actor = await requireActor();
  if (!fields(formData).text.trim()) return;
  await todos.update(actor, String(formData.get("id") ?? ""), fields(formData));
  revalidatePath("/dashboard");
}

export async function moveTodo(formData: FormData) {
  const actor = await requireActor();
  await todos.move(actor, String(formData.get("id") ?? ""), formData.get("dir") === "up" ? "up" : "down");
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
