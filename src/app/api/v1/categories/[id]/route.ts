import { prisma } from "@/lib/db";
import { handler, json, notFound, readJson } from "@/lib/api/respond";
import { categories, categoryInput } from "@/modules/inventory";

export const GET = handler<{ id: string }>("inventory.read", async (_req, _actor, { id }) => {
  const row = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { models: true, children: true } } } });
  if (!row) notFound();
  return json({ data: row });
});

export const PATCH = handler<{ id: string }>("inventory.write", async (req, actor, { id }) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) notFound();
  const patch = await readJson(req, categoryInput.partial());
  const input = categoryInput.parse({ name: existing.name, parentId: existing.parentId ?? "", sortOrder: existing.sortOrder, ...patch });
  return json({ data: await categories.update(actor, id, input) });
});

export const DELETE = handler<{ id: string }>("inventory.write", async (_req, actor, { id }) => {
  await categories.remove(actor, id);
  return json({ ok: true });
});
