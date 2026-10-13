import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextAssetTag } from "@/lib/asset-tag";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { dateFromString } from "@/lib/dates";
import type { Op } from "./plan";

/**
 * Applies a resolved plan in one transaction. Models are matched by
 * (manufacturer, name), categories by path, contacts and locations by
 * name, so running the same workbook twice does not duplicate them; units
 * whose asset tag already exists are skipped. Every row written carries
 * its `importSource` ("Sheet!A1"), and the ActivityLog row lists every id
 * created so an import can be found (and, for test data, removed) later.
 */
export type CommitResult = {
  categories: number;
  models: number;
  units: number;
  bins: number;
  kits: number;
  contacts: number;
  locations: number;
  rentals: number;
  rateTables: number;
  wishes: number;
  purchases: number;
  skipped: string[];
  created: CreatedIds;
};
export type CreatedIds = { categories: string[]; models: string[]; items: string[]; contacts: string[]; locations: string[]; clients: string[]; rentals: string[]; rateTables: string[]; wishes: string[]; purchases: string[] };

const SPLIT = /^([^|]*)\|([^|]*)\|(.*)$/;

export async function applyOps(actor: Actor, ops: Op[], fileName: string): Promise<CommitResult> {
  assertCan(actor, "settings.manage");
  const created: CreatedIds = { categories: [], models: [], items: [], contacts: [], locations: [], clients: [], rentals: [], rateTables: [], wishes: [], purchases: [] };
  const result: CommitResult = { categories: 0, models: 0, units: 0, bins: 0, kits: 0, contacts: 0, locations: 0, rentals: 0, rateTables: 0, wishes: 0, purchases: 0, skipped: [], created };
  const reason = `Imported from ${fileName}`;
  await prisma.$transaction(
    async (tx) => {
      const categoryIds = new Map<string, string>();
      const modelIds = new Map<string, string>();
      const contactIds = new Map<string, string>();
      const locationIds = new Map<string, string>();
      const home = (await tx.location.findFirst({ where: { type: "warehouse", parentId: null }, orderBy: { createdAt: "asc" } }))?.id ?? null;

      const ensureCategory = async (path: string[]): Promise<string> => {
        let parentId: string | null = null;
        let key = "";
        for (const name of path) {
          key += `/${name.toLowerCase()}`;
          let id = categoryIds.get(key);
          if (!id) {
            const existing: { id: string } | null = await tx.category.findFirst({ where: { name: { equals: name, mode: "insensitive" }, parentId }, select: { id: true } });
            if (existing) id = existing.id;
            else {
              id = (await tx.category.create({ data: { name, parentId } })).id;
              created.categories.push(id);
              result.categories++;
            }
            categoryIds.set(key, id);
          }
          parentId = id;
        }
        if (!parentId) throw new Error("Empty category path in import plan");
        return parentId;
      };
      const ensureContact = async (name: string, kind: "person" | "company", notes: string | undefined, src: string): Promise<string> => {
        const k = name.toLowerCase();
        let id = contactIds.get(k);
        if (id) return id;
        const existing = await tx.contact.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
        if (existing) id = existing.id;
        else {
          id = (await tx.contact.create({ data: { name, kind, notes: notes ?? null, importSource: src } })).id;
          created.contacts.push(id);
          result.contacts++;
        }
        contactIds.set(k, id);
        return id;
      };
      /** A person location is tied to a user (matched by name) or to a contact (created on demand). */
      const ensureLocation = async (name: string, kind: "warehouse" | "person", contactName: string | undefined, src: string): Promise<string> => {
        const k = `${kind}:${name.toLowerCase()}`;
        let id = locationIds.get(k);
        if (id) return id;
        let where;
        let data;
        if (kind === "person") {
          const user = contactName ? null : await tx.user.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
          const contactId = user ? null : await ensureContact(contactName ?? name, "person", undefined, src);
          where = user ? { userId: user.id } : { contactId };
          data = { name, type: "person", userId: user?.id ?? null, contactId, importSource: src };
        } else {
          where = { name: { equals: name, mode: "insensitive" as const }, type: "warehouse" };
          data = { name, type: "warehouse", importSource: src };
        }
        const existing = await tx.location.findFirst({ where });
        if (existing) id = existing.id;
        else {
          id = (await tx.location.create({ data })).id;
          created.locations.push(id);
          result.locations++;
        }
        locationIds.set(k, id);
        return id;
      };
      /** Models referenced by key: created in this run, or already in the inventory (e.g. "add to the existing model"). */
      const modelFor = async (key: string): Promise<string> => {
        const known = modelIds.get(key);
        if (known) return known;
        const m = key.match(SPLIT);
        const existing = m ? await tx.model.findFirst({ where: { manufacturer: { equals: m[1], mode: "insensitive" }, name: { equals: m[2], mode: "insensitive" }, variant: m[3] ? { equals: m[3], mode: "insensitive" } : null }, select: { id: true } }) : null;
        if (!existing) throw new Error(`Import plan refers to an unknown model: ${key}`);
        modelIds.set(key, existing.id);
        return existing.id;
      };
      const placeOf = async (op: { status: string; locationName?: string; personName?: string; importSource: string }): Promise<string | null> => {
        if (op.status === "retired" || op.status === "missing") return null;
        if (op.personName) return ensureLocation(op.personName, "person", undefined, op.importSource);
        if (op.locationName) return ensureLocation(op.locationName, "warehouse", undefined, op.importSource);
        return home;
      };
      const statusLog = (status: string) => ({ create: { fromStatus: null, toStatus: status, reason, userId: actor.id } });

      for (const op of ops) {
        switch (op.type) {
          case "contact":
            await ensureContact(op.name, op.kind, op.notes, op.importSource);
            break;
          case "location":
            await ensureLocation(op.name, op.kind, op.contactName, op.importSource);
            break;
          case "model": {
            if (modelIds.has(op.key)) break;
            const existing = await tx.model.findFirst({ where: { manufacturer: { equals: op.manufacturer, mode: "insensitive" }, name: { equals: op.name, mode: "insensitive" }, variant: op.variant ? { equals: op.variant, mode: "insensitive" } : null }, select: { id: true } });
            if (existing) {
              modelIds.set(op.key, existing.id);
              break;
            }
            const categoryId = await ensureCategory(op.categoryPath);
            const m = await tx.model.create({
              data: {
                categoryId,
                manufacturer: op.manufacturer,
                name: op.name,
                variant: op.variant ?? null,
                trackingType: op.tracking,
                weightKg: op.weightKg ?? null,
                powerDrawW: op.powerDrawW ?? null,
                rentalDayPrice: op.rentalDayPrice ?? null,
                notForRental: op.notForRental ?? false,
                notes: op.notes ?? null,
                customFields: op.customFields ?? {},
                importSource: op.importSource,
              },
            });
            modelIds.set(op.key, m.id);
            created.models.push(m.id);
            result.models++;
            break;
          }
          case "modelNote": {
            const id = await modelFor(op.modelKey).catch(() => null);
            if (!id) break;
            const row = await tx.model.findUnique({ where: { id }, select: { notes: true } });
            if (row?.notes?.includes(op.note)) break;
            await tx.model.update({ where: { id }, data: { notes: [row?.notes, op.note].filter(Boolean).join("\n") } });
            break;
          }
          case "bin": {
            if (op.quantity <= 0) break;
            const modelId = await modelFor(op.modelKey);
            const item = await tx.item.create({
              data: {
                modelId,
                assetTag: await nextAssetTag(tx),
                quantity: op.quantity,
                status: op.status,
                retiredReason: op.retiredReason ?? null,
                locationId: await placeOf(op),
                homeLocationId: home,
                notes: op.notes ?? null,
                importSource: op.importSource,
                statusLogs: statusLog(op.status),
              },
            });
            created.items.push(item.id);
            result.bins++;
            break;
          }
          case "unit": {
            const modelId = await modelFor(op.modelKey);
            if (op.assetTag && (await tx.item.findFirst({ where: { assetTag: { equals: op.assetTag, mode: "insensitive" } }, select: { id: true } }))) {
              result.skipped.push(`${op.assetTag} (tag exists)`);
              break;
            }
            const item = await tx.item.create({
              data: {
                modelId,
                assetTag: op.assetTag ?? (await nextAssetTag(tx)),
                name: op.name ?? null,
                serialNumber: op.serialNumber ?? null,
                quantity: 1,
                status: op.status,
                retiredReason: op.retiredReason ?? null,
                notForRental: op.notForRental ?? false,
                locationId: await placeOf(op),
                homeLocationId: home,
                conditionNotes: op.conditionNotes ?? null,
                notes: op.notes ?? null,
                customFields: op.customFields ?? {},
                purchaseDate: op.purchaseDate ? dateFromString(op.purchaseDate) : null,
                purchasePrice: op.purchasePrice ?? null,
                importSource: op.importSource,
                statusLogs: statusLog(op.status),
              },
            });
            created.items.push(item.id);
            result.units++;
            break;
          }
          case "kit": {
            const modelId = await modelFor(op.modelKey);
            for (let i = 1; i <= op.count; i++) {
              const item = await tx.item.create({
                data: { modelId, assetTag: await nextAssetTag(tx), isKit: true, name: `${op.name} ${i}`, status: "in_house", locationId: home, homeLocationId: home, importSource: op.importSource, statusLogs: statusLog("in_house") },
              });
              created.items.push(item.id);
              result.kits++;
            }
            break;
          }
          case "rateTable": {
            if (await tx.rateTable.findFirst({ where: { name: { equals: op.name, mode: "insensitive" } }, select: { id: true } })) {
              result.skipped.push(`${op.name} (rate table exists)`);
              break;
            }
            const hasDefault = (await tx.rateTable.count({ where: { isDefault: true } })) > 0;
            const t = await tx.rateTable.create({ data: { name: op.name, isDefault: op.isDefault && !hasDefault, extraRule: op.extraRule, extraFactor: op.extraFactor, notes: op.notes, importSource: op.importSource, tiers: { create: op.tiers } } });
            created.rateTables.push(t.id);
            result.rateTables++;
            break;
          }
          case "wish": {
            // One wish per sheet row and name: a second import of the same file adds nothing.
            if (await tx.wishItem.findFirst({ where: { importSource: op.importSource, name: { equals: op.name, mode: "insensitive" } }, select: { id: true } })) {
              result.skipped.push(`${op.manufacturer} ${op.name} (wish exists)`.trim());
              break;
            }
            const categoryId = op.categoryPath ? await ensureCategory(op.categoryPath) : null;
            const w = await tx.wishItem.create({ data: { manufacturer: op.manufacturer, name: op.name, variant: op.variant, categoryId, rentalDayPrice: op.rentalDayPrice, notes: op.notes, createdById: actor.id || null, importSource: op.importSource } });
            created.wishes.push(w.id);
            result.wishes++;
            break;
          }
          case "purchase": {
            const modelId = await modelFor(op.modelKey).catch(() => null);
            if (!modelId) {
              result.skipped.push(`${op.reference ?? op.importSource}: no model ${op.modelKey}`);
              break;
            }
            // One record per sheet row and model: a second import of the same file adds nothing.
            if (await tx.purchase.findFirst({ where: { modelId, importSource: op.importSource }, select: { id: true } })) {
              result.skipped.push(`${op.importSource} (purchase record exists)`);
              break;
            }
            const supplierContactId = op.supplierName ? await ensureContact(op.supplierName, "company", undefined, op.importSource) : null;
            const p = await tx.purchase.create({ data: { modelId, supplierContactId, date: op.date ? dateFromString(op.date) : null, reference: op.reference, quantity: op.quantity, listPrice: op.listPrice, discountPct: op.discountPct, netPrice: op.netPrice ?? (op.listPrice === null ? null : Math.round(op.listPrice * (1 - (op.discountPct ?? 0) / 100) * 100) / 100), notes: op.notes, createdById: actor.id || null, importSource: op.importSource } });
            created.purchases.push(p.id);
            result.purchases++;
            break;
          }
          case "rental": {
            let client = await tx.client.findFirst({ where: { name: { equals: op.clientName, mode: "insensitive" } }, select: { id: true } });
            if (!client) {
              client = await tx.client.create({ data: { name: op.clientName }, select: { id: true } });
              created.clients.push(client.id);
            }
            const start = dateFromString(op.startDate);
            const end = dateFromString(op.endDate);
            const rental = await tx.rental.create({ data: { clientId: client.id, status: "out", startDate: start, endDate: end, outAt: start, notes: op.notes, importSource: op.importSource } });
            created.rentals.push(rental.id);
            for (const line of op.lines) {
              const modelId = line.modelKey ? await modelFor(line.modelKey).catch(() => null) : null;
              if (!modelId) continue;
              const rl = await tx.rentalLine.create({ data: { rentalId: rental.id, modelId, quantity: line.quantity, note: line.text } });
              await tx.allocation.create({ data: { holderType: "rental", rentalId: rental.id, rentalLineId: rl.id, modelId, quantity: line.quantity, startDate: start, endDate: end } });
            }
            // Same as clients.ensureLocation (projects module), inside this transaction.
            if (!(await tx.location.findFirst({ where: { renterId: client.id }, select: { id: true } }))) {
              const loc = await tx.location.create({ data: { name: op.clientName, type: "renter", renterId: client.id, importSource: op.importSource } });
              created.locations.push(loc.id);
            }
            result.rentals++;
            break;
          }
        }
      }
      await logActivity(
        actor,
        {
          entityType: "settings",
          entityId: "import",
          action: "spreadsheet_imported",
          summary: `Imported ${fileName}: ${result.categories} categories, ${result.models} models, ${result.units} units, ${result.bins} bins, ${result.kits} cases, ${result.contacts} contacts, ${result.locations} locations, ${result.rentals} rentals, ${result.rateTables} rate tables, ${result.wishes} wishes, ${result.purchases} purchase records`,
          details: { fileName, skipped: result.skipped, created },
        },
        tx,
      );
    },
    { timeout: 600_000, maxWait: 20_000 },
  );
  return result;
}
