import { prisma } from "@/lib/db";
import { handler, json, notFound, readJson } from "@/lib/api/respond";
import { locationInput, locations } from "@/modules/inventory";

export const GET = handler<{ id: string }>("inventory.read", async (_req, _actor, { id }) => {
  const row = await prisma.location.findUnique({ where: { id }, include: { _count: { select: { items: true, children: true } } } });
  if (!row) notFound();
  return json({ data: row });
});

export const PATCH = handler<{ id: string }>("inventory.write", async (req, actor, { id }) => {
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) notFound();
  const patch = await readJson(req, locationInput.partial());
  const input = locationInput.parse({ name: existing.name, type: existing.type, parentId: existing.parentId ?? "", notes: existing.notes ?? "", ...patch });
  return json({ data: await locations.update(actor, id, input) });
});

export const DELETE = handler<{ id: string }>("inventory.write", async (_req, actor, { id }) => {
  await locations.remove(actor, id);
  return json({ ok: true });
});
