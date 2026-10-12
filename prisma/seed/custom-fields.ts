import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * Custom field definitions. `category` is a path in the seeded category
 * tree; fields with a category only show on models/items in that category
 * and its sub-categories. Runs after the inventory seed (needs categories).
 */
type FieldSeed = { entity: string; category?: string; key: string; label: string; type: string; options?: string[]; required?: boolean; sortOrder: number };

const FIELDS: FieldSeed[] = [
  // Projectors
  { entity: "model", category: "Video/Projectors", key: "lumen", label: "Lumen", type: "number", sortOrder: 0 },
  { entity: "model", category: "Video/Projectors", key: "throw_ratio", label: "Throw ratio", type: "text", sortOrder: 1 },
  { entity: "model", category: "Video/Projectors", key: "lens_shift", label: "Lens shift", type: "text", sortOrder: 2 },
  { entity: "model", category: "Video/Projectors", key: "resolution", label: "Resolution", type: "text", sortOrder: 3 },
  // LED controllers (per unit)
  { entity: "item", category: "Lighting/LED controllers", key: "ip_address", label: "IP address", type: "text", sortOrder: 0 },
  { entity: "item", category: "Lighting/LED controllers", key: "board_type", label: "Board type", type: "select", options: ["Teensy 3.2", "Teensy 4", "Teensy 4.0"], sortOrder: 1 },
  { entity: "item", category: "Lighting/LED controllers", key: "firmware", label: "Firmware", type: "text", sortOrder: 2 },
  // Alu profiles
  { entity: "model", category: "Rigging/Alu profiles", key: "finish", label: "Finish", type: "select", options: ["Raw alu", "Black painted"], sortOrder: 0 },
  // Computers (per unit)
  { entity: "item", category: "Computers & networking", key: "cpu", label: "CPU", type: "text", sortOrder: 0 },
  { entity: "item", category: "Computers & networking", key: "gpu", label: "GPU", type: "text", sortOrder: 1 },
  { entity: "item", category: "Computers & networking", key: "ram", label: "RAM", type: "text", sortOrder: 2 },
  { entity: "item", category: "Computers & networking", key: "storage", label: "Storage", type: "text", sortOrder: 3 },
  { entity: "item", category: "Computers & networking", key: "psu", label: "PSU", type: "text", sortOrder: 4 },
  // Truss
  { entity: "model", category: "Rigging/Truss", key: "length_m", label: "Length (m)", type: "number", sortOrder: 0 },
  // Everything
  { entity: "item", key: "lamp_hours", label: "Lamp / laser hours", type: "number", sortOrder: 10 },
  { entity: "item", key: "last_service", label: "Last service", type: "date", sortOrder: 11 },
  { entity: "item", key: "condition", label: "Condition", type: "select", options: ["A – like new", "B – good", "C – worn"], sortOrder: 12 },
];

async function categoryIdByPath(prisma: PrismaClient, path: string): Promise<string | null> {
  let parentId: string | null = null;
  for (const name of path.split("/")) {
    const row: { id: string } | null = await prisma.category.findFirst({ where: { name, parentId }, select: { id: true } });
    if (!row) return null;
    parentId = row.id;
  }
  return parentId;
}

export async function seedCustomFields(prisma: PrismaClient) {
  let count = 0;
  for (const f of FIELDS) {
    const categoryId = f.category ? await categoryIdByPath(prisma, f.category) : null;
    if (f.category && !categoryId) continue;
    const data = { entity: f.entity, categoryId, key: f.key, label: f.label, type: f.type, options: f.options ?? [], required: f.required ?? false, sortOrder: f.sortOrder };
    const existing = await prisma.customFieldDefinition.findFirst({ where: { entity: f.entity, key: f.key, categoryId } });
    if (existing) await prisma.customFieldDefinition.update({ where: { id: existing.id }, data });
    else await prisma.customFieldDefinition.create({ data });
    count++;
  }
  // The Phase 1 placeholder field is superseded by the projector set.
  await prisma.customFieldDefinition.deleteMany({ where: { entity: "model", key: "lens_range", categoryId: null } });
  return count;
}
