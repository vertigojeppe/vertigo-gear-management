import { handler, json, notFound } from "@/lib/api/respond";
import { projectDetail } from "@/modules/projects";

export const GET = handler<{ id: string }>("projects.read", async (_req, _actor, { id }) => {
  const detail = await projectDetail(id);
  if (!detail) notFound();
  return json({ data: { ...detail.project, client: detail.client, contacts: detail.contacts, crew: detail.crew, reservations: detail.reservations } });
});
