import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { PackMode, canPack, listDetail } from "@/modules/packing";

export const metadata: Metadata = { title: "Packing" };

export default async function PackPage(props: { params: Promise<{ id: string; listId: string }> }) {
  await requirePermission("packing.write");
  const { id, listId } = await props.params;
  const detail = await listDetail(listId);
  if (!detail || detail.project.id !== id || !canPack(detail.list.status)) notFound();
  const t = await getTranslations("packing");
  return (
    <div data-wide className="flex flex-col gap-4">
      <PageHeader
        title={`${t("packMode")} · ${detail.list.name}`}
        subtitle={t("packHint")}
        crumbs={[{ label: detail.project.name, href: `/projects/${id}` }, { label: detail.list.name, href: `/projects/${id}/packing/${listId}` }]}
        actions={
          <Link href={`/projects/${id}/packing/${listId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("back")}
          </Link>
        }
      />
      <PackMode ids={{ projectId: id, listId }} lines={detail.lines} units={detail.progress.units} packed={detail.progress.packed} />
    </div>
  );
}
