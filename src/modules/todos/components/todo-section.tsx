import { getTranslations } from "next-intl/server";
import { ArrowDown, ArrowUp, Check, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { todos } from "../service";
import { addTodo, moveTodo, removeTodo, setTodoDone } from "../actions";
import { TodoText } from "./todo-text";

type Lists = Awaited<ReturnType<typeof todos.list>>;
type Row = Lists["done"][number];

const iconButton = "mt-0.5 rounded text-muted-foreground hover:text-foreground focus-visible:outline-2";

/** "My to-dos" on the dashboard: the signed-in person's own notes. Server component with plain forms; only editing a line needs JS. */
export async function TodoSection({ lists }: { lists: Lists }) {
  const t = await getTranslations("todos");

  const row = (r: Row, place?: { first: boolean; last: boolean }) => (
    <li key={r.id} className="flex items-start gap-2 px-3 py-1.5">
      <form action={setTodoDone}>
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="done" value={r.doneAt ? "false" : "true"} />
        <button type="submit" className={iconButton} aria-label={r.doneAt ? t("reopen", { text: r.text }) : t("markDone", { text: r.text })}>
          {r.doneAt ? <Check className="size-4" aria-hidden /> : <Square className="size-4" aria-hidden />}
        </button>
      </form>
      {r.doneAt ? <span className="min-w-0 flex-1 break-words text-muted-foreground line-through">{r.text}</span> : <TodoText id={r.id} text={r.text} category={r.category} />}
      {place && (
        <form action={moveTodo} className="flex gap-1">
          <input type="hidden" name="id" value={r.id} />
          <button type="submit" name="dir" value="up" disabled={place.first} className={`${iconButton} disabled:invisible`} aria-label={t("moveUp", { text: r.text })}>
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button type="submit" name="dir" value="down" disabled={place.last} className={`${iconButton} disabled:invisible`} aria-label={t("moveDown", { text: r.text })}>
            <ArrowDown className="size-4" aria-hidden />
          </button>
        </form>
      )}
      <form action={removeTodo}>
        <input type="hidden" name="id" value={r.id} />
        <button type="submit" className={`${iconButton} hover:text-destructive`} aria-label={t("remove", { text: r.text })}>
          <X className="size-4" aria-hidden />
        </button>
      </form>
    </li>
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-medium">{t("title")}</h2>
      <datalist id="todo-categories">
        {lists.categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <form action={addTodo} className="flex flex-wrap gap-2">
        <Input name="text" required maxLength={500} placeholder={t("placeholder")} aria-label={t("new")} autoComplete="off" className="min-w-0 flex-1 basis-48" />
        <Input name="category" maxLength={60} list="todo-categories" placeholder={t("categoryPlaceholder")} aria-label={t("category")} autoComplete="off" className="w-36" />
        <Button type="submit" variant="outline">
          {t("add")}
        </Button>
      </form>
      {lists.groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        lists.groups.map((g) => (
          <div key={g.category ?? ""} className="flex flex-col gap-1">
            {g.category && <h3 className="text-sm font-medium">{g.category}</h3>}
            <ul className="divide-y rounded-md border text-sm">{g.rows.map((r, i) => row(r, { first: i === 0, last: i === g.rows.length - 1 }))}</ul>
          </div>
        ))
      )}
      {lists.done.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("done", { count: lists.done.length })}</summary>
          <ul className="mt-2 divide-y rounded-md border">{lists.done.map((r) => row(r))}</ul>
        </details>
      )}
    </section>
  );
}
