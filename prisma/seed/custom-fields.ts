import type { PrismaClient } from "../../src/generated/prisma/client";

const FIELDS = [
  { entity: "model", key: "lens_range", label: "Lens throw ratio", type: "text", options: [], required: false, sortOrder: 0 },
  { entity: "item", key: "lamp_hours", label: "Lamp / laser hours", type: "number", options: [], required: false, sortOrder: 0 },
  { entity: "item", key: "last_service", label: "Last service", type: "date", options: [], required: false, sortOrder: 1 },
  { entity: "item", key: "condition", label: "Condition", type: "select", options: ["A – like new", "B – good", "C – worn"], required: false, sortOrder: 2 },
];

export async function seedCustomFields(prisma: PrismaClient) {
  for (const f of FIELDS) {
    await prisma.customFieldDefinition.upsert({
      where: { entity_key: { entity: f.entity, key: f.key } },
      update: { label: f.label, type: f.type, options: f.options, required: f.required, sortOrder: f.sortOrder },
      create: f,
    });
  }
  return FIELDS.length;
}
