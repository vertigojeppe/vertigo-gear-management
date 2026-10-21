import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Download, ExternalLink, Play } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { AppRow } from "../queries";

/** The main button of an app: download the newest file, open the link, or run the tool. */
export async function AppAction({ app, size = "sm" }: { app: Pick<AppRow, "id" | "kind" | "url" | "latest" | "name">; size?: "sm" | "default" }) {
  const t = await getTranslations("apps");
  if (app.kind === "link" && app.url)
    return (
      <a href={app.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size })} aria-label={`${t("open")} ${app.name}`}>
        <ExternalLink className="size-4" aria-hidden />
        {t("open")}
      </a>
    );
  if (!app.latest) return <span className="text-xs text-muted-foreground">{t("noVersionYet")}</span>;
  if (app.kind === "tool")
    return (
      <Link href={`/apps/${app.id}/run`} className={buttonVariants({ size })} aria-label={`${t("run")} ${app.name}`}>
        <Play className="size-4" aria-hidden />
        {t("run")}
      </Link>
    );
  return (
    <a href={`/api/files/${app.latest.file.id}?download=1`} className={buttonVariants({ size, variant: "outline" })} aria-label={`${t("download")} ${app.name}`}>
      <Download className="size-4" aria-hidden />
      {t("download")}
    </a>
  );
}
