import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { canCheckIn, listDetail } from "@/modules/packing";
import { CheckInMode } from "@/modules/packing/components/checkin-mode";
import { FinishCheckInButton } from "@/modules/packing/components/list-buttons";

export const metadata: Metadata = { title: "Check-in" };

export default async function CheckInPage(props: { params: Promise<{ id: string; listId: string }> }) {
  await requirePermission("packing.write");
  const { id, listId } = await props.params;
  const detail = await listDetail(listId);
  if (!detail || detail.project.id !== id || !canCheckIn(detail.list.status)) notFound();
  const t = await getTranslations("packing");
  const ids = { projectId: id, listId };
  return (
    <div data-wide className="flex flex-col gap-4">
      <PageHeader
        title={`${t("checkInMode")} · ${detail.list.name}`}
        subtitle={t("checkInHint")}
        crumbs={[{ label: detail.project.name, href: `/projects/${id}` }, { label: detail.list.name, href: `/projects/${id}/packing/${listId}` }]}
        actions={
          <>
            <Link href={`/projects/${id}/packing/${listId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("back")}
            </Link>
            <FinishCheckInButton ids={ids} stillOut={detail.progress.toReturn} />
          </>
        }
      />
      <CheckInMode ids={ids} lines={detail.lines} />
    </div>
  );
}
