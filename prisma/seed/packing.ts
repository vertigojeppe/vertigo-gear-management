import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * One reusable packing template and one draft packing list on the Roskilde
 * project, so the packing screens have something to show straight away.
 */
export async function seedPacking(prisma: PrismaClient) {
  const modelId = async (name: string) => (await prisma.model.findFirst({ where: { name } }))?.id;

  const TEMPLATES = [
    {
      name: "Laser show – standard",
      description: "Two Clubmax lasers with safety kit, cabling and a small truss rig.",
      lines: [
        { model: "Clubmax 6000 FB4", qty: 2 },
        { model: "Safety interlock key", qty: 2 },
        { model: "E-stop remote", qty: 2 },
        { model: "Beam block set", qty: 2 },
        { model: "H30V 2 m", qty: 4 },
        { model: "Half coupler 50 mm", qty: 8 },
        { model: "DMX 5-pin 10 m", qty: 4 },
        { model: "powerCON TRUE1 link 5 m", qty: 4 },
        { model: "CEE 16 A 25 m", qty: 1 },
      ],
    },
  ];

  let templates = 0;
  for (const t of TEMPLATES) {
    const existing = await prisma.packingTemplate.findFirst({ where: { name: t.name } });
    const tpl = existing
      ? await prisma.packingTemplate.update({ where: { id: existing.id }, data: { description: t.description } })
      : await prisma.packingTemplate.create({ data: { name: t.name, description: t.description } });
    let sort = 0;
    for (const l of t.lines) {
      const mid = await modelId(l.model);
      if (!mid) continue;
      const line = await prisma.packingTemplateLine.findFirst({ where: { templateId: tpl.id, modelId: mid } });
      if (line) await prisma.packingTemplateLine.update({ where: { id: line.id }, data: { quantity: l.qty, sortOrder: sort } });
      else await prisma.packingTemplateLine.create({ data: { templateId: tpl.id, modelId: mid, quantity: l.qty, sortOrder: sort } });
      sort++;
    }
    templates++;
  }

  // A draft list on the Roskilde project built from its reservations plus the two laser cases.
  const roskilde = await prisma.project.findFirst({ where: { name: "Roskilde Festival – Orange stage" } });
  let lists = 0;
  if (roskilde) {
    const name = "Orange stage – truck 1";
    let list = await prisma.packingList.findFirst({ where: { projectId: roskilde.id, name } });
    if (!list) {
      list = await prisma.packingList.create({ data: { projectId: roskilde.id, name, groupBy: "category", notes: "Load laser cases last so they come off first." } });
      const allocs = await prisma.allocation.findMany({ where: { projectId: roskilde.id } });
      let sort = 0;
      for (const a of allocs) {
        await prisma.packingLine.create({ data: { listId: list.id, modelId: a.modelId, quantity: a.quantity, sortOrder: sort++ } });
      }
      const kits = await prisma.item.findMany({ where: { isKit: true, name: { startsWith: "Laser case" } }, orderBy: { name: "asc" } });
      for (const k of kits) {
        await prisma.packingLine.create({ data: { listId: list.id, modelId: k.modelId, quantity: 1, itemId: k.id, caseItemId: k.id, note: k.name, sortOrder: sort++ } });
      }
    }
    lists++;
  }
  return { templates, lists };
}
