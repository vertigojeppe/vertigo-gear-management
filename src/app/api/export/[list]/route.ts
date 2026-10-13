import { NextResponse, type NextRequest } from "next/server";
import { can, getActor } from "@/lib/auth/session";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { modelLabel } from "@/lib/format";
import type { Permission } from "../../../../../config/app.config";
import { contactList } from "@/modules/contacts";
import { itemFilters, listItems, listModels, modelFilters, type ItemListRow, type ModelListRow } from "@/modules/inventory";
import { listProjects, projectFilters, type ProjectListRow } from "@/modules/projects";
import { listRentals, rentalFilters, type RentalListRow } from "@/modules/rentals";
import { wishList, type WishRow } from "@/modules/wishlist";

const MAX_PAGES = 200;

/**
 * CSV of a list page with its current filters: /api/export/<list>.csv?…
 * Lists: models, items, projects, rentals, contacts, wishes. Pages of the list
 * query are walked until the end (or 200 pages), so the file matches
 * what the page shows, filters and all.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ list: string }> }) {
  const { list } = await ctx.params;
  const name = list.replace(/\.csv$/, "");
  const def = LISTS[name];
  if (!def) return new NextResponse("Unknown list", { status: 404 });
  const actor = await getActor();
  if (!actor || !can(actor.role, def.permission)) return new NextResponse("Unauthorized", { status: 401 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const rows = await def.rows(sp);
  const csv = toCsv(rows, def.columns as CsvColumn<unknown>[], req.nextUrl.searchParams.get("sep") === "," ? "," : ";");
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"`, "Cache-Control": "no-store" },
  });
}

type ListDef<T> = { permission: Permission; rows: (sp: Record<string, string>) => Promise<T[]>; columns: CsvColumn<T>[] };

async function allPages<T>(fetch: (page: number) => Promise<{ rows: T[]; pages: number }>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await fetch(page);
    out.push(...r.rows);
    if (page >= r.pages) break;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LISTS: Record<string, ListDef<any>> = {
  models: {
    permission: "inventory.read",
    rows: (sp) => allPages(async (page) => {
      const r = await listModels({ ...modelFilters.parse(sp), page });
      return { rows: r.families.flatMap((f) => f.variants), pages: r.pages };
    }),
    columns: [
      { key: "manufacturer", header: "Manufacturer", value: (m: ModelListRow) => m.manufacturer },
      { key: "name", header: "Model", value: (m: ModelListRow) => m.name },
      { key: "variant", header: "Variant", value: (m: ModelListRow) => m.variant },
      { key: "category", header: "Category", value: (m: ModelListRow) => m.categoryPath.join(" › ") },
      { key: "tracking", header: "Tracking", value: (m: ModelListRow) => m.trackingType },
      { key: "inHouse", header: "In house", value: (m: ModelListRow) => m.inHouse },
      { key: "owned", header: "Owned", value: (m: ModelListRow) => m.owned },
      { key: "weightKg", header: "Weight (kg)", value: (m: ModelListRow) => m.weightKg },
      { key: "powerDrawW", header: "Power (W)", value: (m: ModelListRow) => m.powerDrawW },
      { key: "rentalDayPrice", header: "Day price", value: (m: ModelListRow) => m.rentalDayPrice },
      { key: "notForRental", header: "Not for rental", value: (m: ModelListRow) => m.notForRental },
      { key: "archived", header: "Archived", value: (m: ModelListRow) => m.archived },
      { key: "notes", header: "Notes", value: (m: ModelListRow) => m.notes },
      { key: "id", header: "Id", value: (m: ModelListRow) => m.id },
    ],
  },
  items: {
    permission: "inventory.read",
    rows: (sp) => allPages(async (page) => listItems({ ...itemFilters.parse(sp), page })),
    columns: [
      { key: "assetTag", header: "Asset tag", value: (i: ItemListRow) => i.assetTag },
      { key: "model", header: "Model", value: (i: ItemListRow) => modelLabel(i.model) },
      { key: "name", header: "Name", value: (i: ItemListRow) => i.name },
      { key: "serialNumber", header: "Serial", value: (i: ItemListRow) => i.serialNumber },
      { key: "quantity", header: "Quantity", value: (i: ItemListRow) => i.quantity },
      { key: "status", header: "Status", value: (i: ItemListRow) => i.status },
      { key: "location", header: "Location", value: (i: ItemListRow) => i.locationName },
      { key: "parent", header: "In kit", value: (i: ItemListRow) => i.parentLabel },
      { key: "category", header: "Category", value: (i: ItemListRow) => i.categoryPath.join(" › ") },
      { key: "purchaseDate", header: "Purchase date", value: (i: ItemListRow) => i.purchaseDate },
      { key: "purchasePrice", header: "Purchase price", value: (i: ItemListRow) => i.purchasePrice },
      { key: "notes", header: "Notes", value: (i: ItemListRow) => i.notes },
      { key: "id", header: "Id", value: (i: ItemListRow) => i.id },
    ],
  },
  projects: {
    permission: "projects.read",
    rows: (sp) => allPages(async (page) => listProjects({ ...projectFilters.parse(sp), page })),
    columns: [
      { key: "name", header: "Project", value: (p: ProjectListRow) => p.name },
      { key: "client", header: "Client", value: (p: ProjectListRow) => p.clientName },
      { key: "status", header: "Status", value: (p: ProjectListRow) => p.status },
      { key: "venue", header: "Venue", value: (p: ProjectListRow) => p.venueName },
      { key: "prepStart", header: "Prep start", value: (p: ProjectListRow) => p.prepStart },
      { key: "loadIn", header: "Load-in", value: (p: ProjectListRow) => p.loadIn },
      { key: "showStart", header: "Show start", value: (p: ProjectListRow) => p.showStart },
      { key: "showEnd", header: "Show end", value: (p: ProjectListRow) => p.showEnd },
      { key: "loadOut", header: "Load-out", value: (p: ProjectListRow) => p.loadOut },
      { key: "returnDate", header: "Return", value: (p: ProjectListRow) => p.returnDate },
      { key: "crew", header: "Crew", value: (p: ProjectListRow) => p.crewCount },
      { key: "reservations", header: "Reservations", value: (p: ProjectListRow) => p.reservationCount },
      { key: "notes", header: "Notes", value: (p: ProjectListRow) => p.notes },
      { key: "id", header: "Id", value: (p: ProjectListRow) => p.id },
    ],
  },
  rentals: {
    permission: "rentals.read",
    rows: (sp) => allPages(async (page) => listRentals({ ...rentalFilters.parse(sp), page })),
    columns: [
      { key: "client", header: "Renter", value: (r: RentalListRow) => r.clientName },
      { key: "status", header: "Status", value: (r: RentalListRow) => r.effectiveStatus },
      { key: "startDate", header: "From", value: (r: RentalListRow) => r.startDate },
      { key: "endDate", header: "To", value: (r: RentalListRow) => r.endDate },
      { key: "lines", header: "Lines", value: (r: RentalListRow) => r.lineCount },
      { key: "total", header: "Subtotal excl. VAT", value: (r: RentalListRow) => r.total },
      { key: "deposit", header: "Deposit", value: (r: RentalListRow) => r.deposit },
      { key: "outAt", header: "Handed out", value: (r: RentalListRow) => r.outAt },
      { key: "returnedAt", header: "Returned", value: (r: RentalListRow) => r.returnedAt },
      { key: "notes", header: "Notes", value: (r: RentalListRow) => r.notes },
      { key: "id", header: "Id", value: (r: RentalListRow) => r.id },
    ],
  },
  wishes: {
    permission: "inventory.read",
    rows: (sp) => wishList(sp.status === "bought" ? "bought" : sp.status === "all" ? "all" : "open"),
    columns: [
      { key: "manufacturer", header: "Manufacturer", value: (w: WishRow) => w.manufacturer },
      { key: "name", header: "Name", value: (w: WishRow) => w.name },
      { key: "variant", header: "Variant", value: (w: WishRow) => w.variant },
      { key: "category", header: "Category", value: (w: WishRow) => w.categoryName },
      { key: "quantity", header: "Quantity", value: (w: WishRow) => w.quantity },
      { key: "price", header: "Price", value: (w: WishRow) => w.price },
      { key: "rentalDayPrice", header: "Rental day price", value: (w: WishRow) => w.rentalDayPrice },
      { key: "link", header: "Link", value: (w: WishRow) => w.link },
      { key: "notes", header: "Notes", value: (w: WishRow) => w.notes },
      { key: "status", header: "Status", value: (w: WishRow) => w.status },
      { key: "model", header: "Became model", value: (w: WishRow) => w.modelLabel },
      { key: "id", header: "Id", value: (w: WishRow) => w.id },
    ],
  },
  contacts: {
    permission: "contacts.read",
    rows: () => contactList(),
    columns: [
      { key: "name", header: "Name", value: (c: ContactRow) => c.name },
      { key: "kind", header: "Kind", value: (c: ContactRow) => c.kind },
      { key: "organisation", header: "Organisation", value: (c: ContactRow) => c.organisation },
      { key: "email", header: "Email", value: (c: ContactRow) => c.email },
      { key: "phone", header: "Phone", value: (c: ContactRow) => c.phone },
      { key: "address", header: "Address", value: (c: ContactRow) => c.address },
      { key: "notes", header: "Notes", value: (c: ContactRow) => c.notes },
      { key: "id", header: "Id", value: (c: ContactRow) => c.id },
    ],
  },
};

type ContactRow = Awaited<ReturnType<typeof contactList>>[number];
