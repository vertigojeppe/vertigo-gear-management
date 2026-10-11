import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { outboxAdmin, webhooks } from "@/modules/settings";
import { DeleteWebhookButton, RetryButton, RunNowButton, WebhookDialog } from "./forms";

export const metadata: Metadata = { title: "Webhooks" };

const STATUS_COLOR: Record<string, string> = { pending: "gray", processing: "blue", done: "green", failed: "red" };

export default async function WebhooksPage() {
  await requirePermission("settings.manage");
  const t = await getTranslations("settings");
  const [rows, queue, counts] = await Promise.all([webhooks.list(), outboxAdmin.recent(30), outboxAdmin.counts()]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("webhooks")} subtitle={t("webhooksHelp")} crumbs={[{ label: t("title"), href: "/settings" }, { label: t("webhooks") }]} actions={<WebhookDialog trigger="new" />} />
      {rows.length === 0 ? (
        <EmptyState title={t("noWebhooks")} body={t("noWebhooksBody")} />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {w.name}
                  {!w.active && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">off</span>}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {w.url} · {w.events.length === 0 ? "*" : w.events.join(", ")}
                </span>
              </span>
              <WebhookDialog trigger="edit" webhook={{ id: w.id, name: w.name, url: w.url, secret: w.secret, events: w.events, active: w.active }} />
              <DeleteWebhookButton id={w.id} />
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium">{t("outbox")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("outboxHelp")} {Object.entries(counts).map(([k, v]) => `${t(`outboxStatus.${k as "pending"}`)}: ${v}`).join(" · ")}
            </p>
          </div>
          <RunNowButton />
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("outboxEmpty")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {queue.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                <StatusPill color={STATUS_COLOR[row.status] ?? "gray"}>{t(`outboxStatus.${row.status as "pending"}`)}</StatusPill>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs">{row.type}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDateTime(row.createdAt)} · {t("attempts", { count: row.attempts })}
                    {row.lastError ? ` · ${row.lastError}` : ""}
                  </span>
                </span>
                {row.status === "failed" && <RetryButton id={row.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
