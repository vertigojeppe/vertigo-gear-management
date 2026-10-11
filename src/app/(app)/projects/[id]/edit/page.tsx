import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { ProjectForm, clientOptions, projects } from "@/modules/projects";
import { customFieldDefinitions } from "@/modules/settings";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("projects.write");
  const { id } = await props.params;
  const t = await getTranslations("projects");
  const [project, clients, defs] = await Promise.all([projects.get(id), clientOptions(), customFieldDefinitions.forEntity("project")]);
  if (!project) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("editProject")} crumbs={[{ label: t("title"), href: "/projects" }, { label: project.name, href: `/projects/${id}` }, { label: t("editProject") }]} />
      <ProjectForm project={project} clients={clients} defs={defs} />
    </div>
  );
}
