import { getTranslations } from "next-intl/server";
import { Check, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { todos } from "../service";
import { addTodo, removeTodo, setTodoDone } from "../actions";

type Lists = Awaited<ReturnType<typeof todos.list>>;
type Row = Lists["open"][number];

/** "My to-dos" on the dashboard: the signed-in person's own notes. Server component; plain forms, so it works without JS. */
export async function TodoSection({ lists }: { lists: Lists }) {
  const t = await getTranslations("todos");

  const row = (r: Row) => (
    <li key={r.id} className="flex items-start gap-2 px-3 py-1.5">
      <form action={setTodoDone}>
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="done" value={r.doneAt ? "false" : "true"} />
        <button type="submit" className="mt-0.5 rounded text-muted-foreground hover:text-foreground focus-visible:outline-2" aria-label={r.doneAt ? t("reopen", { text: r.text }) : t("markDone", { text: r.text })}>
          {r.doneAt ? <Check className="size-4" aria-hidden /> : <Square className="size-4" aria-hidden />}
        </button>
      </form>
      <span className={r.doneAt ? "min-w-0 flex-1 break-words text-muted-foreground line-through" : "min-w-0 flex-1 break-words"}>{r.text}</span>
      <form action={removeTodo}>
        <input type="hidden" name="id" value={r.id} />
        <button type="submit" className="mt-0.5 rounded text-muted-foreground hover:text-destructive focus-visible:outline-2" aria-label={t("remove", { text: r.text })}>
          <X className="size-4" aria-hidden />
        </button>
      </form>
    </li>
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-medium">{t("title")}</h2>
      <form action={addTodo} className="flex gap-2">
        <Input name="text" required maxLength={500} placeholder={t("placeholder")} aria-label={t("new")} autoComplete="off" />
        <Button type="submit" variant="outline">
          {t("add")}
        </Button>
      </form>
      {lists.open.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : <ul className="divide-y rounded-md border text-sm">{lists.open.map(row)}</ul>}
      {lists.done.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("done", { count: lists.done.length })}</summary>
          <ul className="mt-2 divide-y rounded-md border">{lists.done.map(row)}</ul>
        </details>
      )}
    </section>
  );
}
