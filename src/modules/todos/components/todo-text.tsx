"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateTodo } from "../actions";

/** An open to-do's text; clicking it edits text and category in place (Enter saves, Escape cancels). */
export function TodoText({ id, text, category }: { id: string; text: string; category: string | null }) {
  const t = useTranslations("todos");
  const [editing, setEditing] = useState(false);

  if (!editing)
    return (
      <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 break-words rounded text-left hover:underline focus-visible:outline-2" aria-label={t("edit", { text })}>
        {text}
      </button>
    );

  return (
    <form
      action={async (fd) => {
        await updateTodo(fd);
        setEditing(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
      className="flex min-w-0 flex-1 flex-wrap gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Input name="text" defaultValue={text} required maxLength={500} autoFocus aria-label={t("new")} className="h-8 min-w-0 flex-1 basis-48" />
      <Input name="category" defaultValue={category ?? ""} maxLength={60} list="todo-categories" placeholder={t("categoryPlaceholder")} aria-label={t("category")} className="h-8 w-36" />
      <Button type="submit" size="sm" className="h-8">
        {t("save")}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>
        {t("cancel")}
      </Button>
    </form>
  );
}
