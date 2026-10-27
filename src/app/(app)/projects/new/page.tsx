import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { clientOptions } from "@/modules/projects";
import { ProjectForm } from "@/modules/projects/components/project-form";
import { customFieldDefinitions } from "@/modules/settings";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requirePermission("projects.write");
  const t = await getTranslations("projects");
  const [clients, defs] = await Promise.all([clientOptions(), customFieldDefinitions.forEntity("project")]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("newProject")} crumbs={[{ label: t("title"), href: "/projects" }, { label: t("newProject") }]} />
      <ProjectForm clients={clients} defs={defs} />
    </div>
  );
}
