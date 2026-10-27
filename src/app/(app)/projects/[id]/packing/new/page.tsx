import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { otherListsForCopy, templateOptions } from "@/modules/packing";
import { NewListForm } from "@/modules/packing/components/new-list-form";
import { projects } from "@/modules/projects";
import { prisma } from "@/lib/db";
import { projectGearEnabled } from "@/lib/features";

export const metadata: Metadata = { title: "New packing list" };

export default async function NewPackingListPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("packing.write");
  const { id } = await props.params;
  const project = await projects.get(id);
  if (!project) notFound();
  const t = await getTranslations("packing");
  const tp = await getTranslations("projects");
  const [templates, others, reservations] = await Promise.all([templateOptions(), otherListsForCopy(id), prisma.allocation.count({ where: { projectId: id } })]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("newList")} crumbs={[{ label: tp("title"), href: "/projects" }, { label: project.name, href: `/projects/${id}` }, { label: t("newList") }]} />
      <NewListForm
        projectId={id}
        defaultName={t("title") === "Packing lists" ? "Packing list" : "Pakkeliste"}
        templates={templates.map((x) => ({ id: x.id, label: `${x.name} (${x._count.lines})` }))}
        otherLists={others}
        hasReservations={projectGearEnabled() && reservations > 0}
      />
    </div>
  );
}
