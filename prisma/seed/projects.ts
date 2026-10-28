import type { PrismaClient } from "../../src/generated/prisma/client";
import { splitVariant } from "../../src/lib/variant";
import { addDays, dateFromString, today, zonedInputToDate } from "../../src/lib/dates";

/**
 * Demo clients, projects at different stages, reservations and rentals.
 * Dates are relative to today so the dashboard and calendar always show
 * something. Re-runnable: matched by name.
 */
const CLIENTS = [
  { name: "Roskilde Festival", contactName: "Mads Bruun", email: "mads@roskilde-festival.example", phone: "+45 46 36 66 13", address: "Darupvej 19, 4000 Roskilde" },
  { name: "Det Kongelige Teater", contactName: "Signe Holm", email: "signe@kglteater.example", phone: "+45 33 69 69 33", address: "Kongens Nytorv 9, 1050 København K" },
  { name: "Nordic Light Rental", contactName: "Jonas Berg", email: "jonas@nordiclight.example", phone: "+45 70 20 30 40", address: "Industrivej 4, 2600 Glostrup" },
  { name: "CPH Light Festival", contactName: "Anna Kjær", email: "anna@cphlight.example", phone: "+45 31 31 31 31", address: "Københavns Rådhus, 1599 København V" },
  { name: "Vega", contactName: "Booking", email: "tech@vega.example", phone: "+45 33 25 70 11", address: "Enghavevej 40, 1674 København V" },
];

export async function seedProjects(prisma: PrismaClient) {
  const clientIds = new Map<string, string>();
  for (const c of CLIENTS) {
    const existing = await prisma.client.findFirst({ where: { name: c.name } });
    const row = existing ? await prisma.client.update({ where: { id: existing.id }, data: c }) : await prisma.client.create({ data: c });
    clientIds.set(c.name, row.id);
  }

  const users = await prisma.user.findMany({ orderBy: { email: "asc" } });
  const t = today();
  const d = (offset: number) => addDays(t, offset);
  const dt = (offset: number, hhmm: string) => zonedInputToDate(`${addDays(t, offset)}T${hhmm}`);

  // build / pack: first day, last day, call time.
  const PROJECTS = [
    {
      name: "Distortion 2026 – Nørrebro stage",
      client: "CPH Light Festival",
      venueName: "Nørrebrogade",
      venueAddress: "Nørrebrogade, 2200 København N",
      status: "done",
      prepStart: d(-40),
      prepEnd: d(-39),
      build: [d(-38), d(-38), "08:00"],
      showStart: dt(-37, "18:00"),
      showEnd: dt(-36, "02:00"),
      pack: [d(-36), d(-36), "08:00"],
      returnDate: d(-35),
      notes: "Laser show on the main stage. Done and settled.",
      crew: [{ email: "admin@vertigo.test", role: "Laser op" }, { email: "member@vertigo.test", role: "Rigger" }],
      reservations: [
        { model: "Clubmax 6000 FB4", qty: 2 },
        { model: "MAC Aura XB", qty: 6 },
      ],
    },
    {
      name: "Roskilde Festival – Orange stage",
      client: "Roskilde Festival",
      venueName: "Orange Scene",
      venueAddress: "Darupvej 19, 4000 Roskilde",
      status: "in_progress",
      prepStart: d(-4),
      prepEnd: d(-3),
      build: [d(-2), d(-1), "07:00"],
      showStart: dt(0, "20:00"),
      showEnd: dt(3, "02:00"),
      pack: [d(3), d(4), "09:00"],
      returnDate: d(4),
      notes: "Projection mapping on the back wall + laser from FOH tower.",
      links: [{ label: "Stage plot (Drive)", url: "https://drive.google.com/example" }],
      crew: [{ email: "admin@vertigo.test", role: "Projection", callTime: dt(-2, "06:30") }, { email: "member@vertigo.test", role: "Lighting", callTime: dt(-2, "07:00") }],
      contacts: [{ name: "Stage manager Orange", role: "SM", phone: "+45 40 40 40 40" }],
      reservations: [
        { model: "PT-RZ21K", qty: 2 },
        { model: "JDC1", qty: 4 },
        { model: "MAC Aura XB", qty: 6 },
        { model: "H30V 3 m", qty: 8 },
      ],
    },
    {
      name: "Hamlet – Gamle Scene",
      client: "Det Kongelige Teater",
      venueName: "Gamle Scene",
      venueAddress: "Kongens Nytorv 9, 1050 København K",
      status: "confirmed",
      prepStart: d(10),
      prepEnd: d(11),
      build: [d(12), d(13), "08:00"],
      showStart: dt(14, "19:30"),
      showEnd: dt(30, "22:00"),
      pack: [d(31), d(31), "09:00"],
      returnDate: d(31),
      notes: "Three weeks run. Two projectors on the balcony, media server at FOH.",
      crew: [{ email: "admin@vertigo.test", role: "Video designer" }],
      contacts: [{ name: "Teknisk chef", role: "Technical director", email: "teknik@kglteater.example" }],
      reservations: [
        { model: "PT-RZ120", qty: 2 },
        { model: "vx 2", qty: 1 },
        { model: "MD-HX", qty: 2 },
        { model: "SDI BNC 25 m", qty: 6 },
      ],
    },
    {
      name: "Vega – album release show",
      client: "Vega",
      venueName: "Store Vega",
      venueAddress: "Enghavevej 40, 1674 København V",
      status: "quote",
      prepStart: d(20),
      prepEnd: d(20),
      build: [d(21), d(21), "10:00"],
      showStart: dt(21, "21:00"),
      showEnd: dt(21, "23:30"),
      pack: [d(22), d(22), "01:00"],
      returnDate: d(22),
      notes: "Quote sent. Laser + 8 Pointes. Conflicts with Hamlet on projectors if they want video too.",
      reservations: [
        { model: "Pointe", qty: 8 },
        { model: "Clubmax 6000 FB4", qty: 2 },
        { model: "PT-RZ120", qty: 2 },
      ],
    },
  ];

  let projectCount = 0;
  let allocationCount = 0;
  for (const p of PROJECTS) {
    const data = {
      name: p.name,
      clientId: clientIds.get(p.client) ?? null,
      venueName: p.venueName,
      venueAddress: p.venueAddress,
      status: p.status,
      prepStart: dateFromString(p.prepStart),
      prepEnd: dateFromString(p.prepEnd),
      buildStart: dateFromString(p.build[0]),
      buildEnd: dateFromString(p.build[1]),
      buildCall: p.build[2],
      showStart: p.showStart,
      showEnd: p.showEnd,
      packStart: dateFromString(p.pack[0]),
      packEnd: dateFromString(p.pack[1]),
      packCall: p.pack[2],
      returnDate: dateFromString(p.returnDate),
      reserveFrom: dateFromString(p.prepStart),
      reserveTo: dateFromString(p.returnDate),
      notes: p.notes,
      externalLinks: p.links ?? [],
    };
    const existing = await prisma.project.findFirst({ where: { name: p.name } });
    const project = existing ? await prisma.project.update({ where: { id: existing.id }, data }) : await prisma.project.create({ data });
    projectCount++;
    const loc = await prisma.location.findFirst({ where: { projectId: project.id } });
    if (!loc) await prisma.location.create({ data: { name: project.name, type: "project", projectId: project.id } });

    for (const c of p.crew ?? []) {
      const user = users.find((u) => u.email === c.email);
      if (!user) continue;
      await prisma.projectCrew.upsert({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
        update: { role: c.role, callTime: (c as { callTime?: Date }).callTime ?? null },
        create: { projectId: project.id, userId: user.id, role: c.role, callTime: (c as { callTime?: Date }).callTime ?? null },
      });
    }
    for (const { role, ...person } of p.contacts ?? []) {
      // The person lives in the contact library; the project links to them with this job's role.
      const contact = (await prisma.contact.findFirst({ where: { name: person.name } })) ?? (await prisma.contact.create({ data: { kind: "person", ...person } }));
      const exists = await prisma.projectContact.findFirst({ where: { projectId: project.id, contactId: contact.id } });
      if (!exists) await prisma.projectContact.create({ data: { projectId: project.id, contactId: contact.id, role } });
    }
    for (const r of p.reservations) {
      const model = await prisma.model.findFirst({ where: splitVariant(r.model) });
      if (!model) continue;
      const exists = await prisma.allocation.findFirst({ where: { projectId: project.id, modelId: model.id } });
      if (exists) {
        await prisma.allocation.update({ where: { id: exists.id }, data: { quantity: r.qty, startDate: data.reserveFrom, endDate: data.reserveTo } });
      } else {
        await prisma.allocation.create({ data: { holderType: "project", projectId: project.id, modelId: model.id, quantity: r.qty, startDate: data.reserveFrom, endDate: data.reserveTo } });
      }
      allocationCount++;
    }
  }

  // Move the "Roskilde" placeholder location from Phase 1 under the project if it still exists.
  const placeholder = await prisma.location.findFirst({ where: { name: "Roskilde Festival – Orange stage", projectId: null } });
  const roskilde = await prisma.project.findFirst({ where: { name: "Roskilde Festival – Orange stage" } });
  if (placeholder && roskilde) {
    const projectLoc = await prisma.location.findFirst({ where: { projectId: roskilde.id } });
    if (projectLoc && projectLoc.id !== placeholder.id) {
      await prisma.item.updateMany({ where: { locationId: placeholder.id }, data: { locationId: projectLoc.id } });
      await prisma.location.delete({ where: { id: placeholder.id } });
    }
  }

  // Rentals
  const RENTALS = [
    {
      client: "Nordic Light Rental",
      status: "out",
      startDate: d(-6),
      endDate: d(-1), // overdue
      outAt: dt(-6, "10:00"),
      deposit: 10000,
      notes: "Atom 20 + 2 hoists for a corporate event in Malmö.",
      lines: [
        { model: "Atom 20", qty: 1, pricePerDay: 2500, assign: true },
        { model: "Lodestar D8+ 1 t", qty: 2, pricePerDay: 350, assign: true },
      ],
    },
    {
      client: "Nordic Light Rental",
      status: "reserved",
      startDate: d(15),
      endDate: d(18),
      deposit: 5000,
      notes: "Weekend rental: 6 Pointes with cases.",
      lines: [{ model: "Pointe", qty: 6, pricePerDay: 400 }],
    },
  ];
  let rentalCount = 0;
  for (const r of RENTALS) {
    const clientId = clientIds.get(r.client)!;
    const existing = await prisma.rental.findFirst({ where: { clientId, notes: r.notes } });
    const data = {
      clientId,
      status: r.status,
      startDate: dateFromString(r.startDate),
      endDate: dateFromString(r.endDate),
      outAt: "outAt" in r ? r.outAt : null,
      deposit: r.deposit,
      notes: r.notes,
    };
    const rental = existing ? await prisma.rental.update({ where: { id: existing.id }, data }) : await prisma.rental.create({ data });
    rentalCount++;
    const renterLoc =
      (await prisma.location.findFirst({ where: { renterId: clientId } })) ??
      (await prisma.location.findFirst({ where: { name: r.client, renterId: null } }).then((l) => (l ? prisma.location.update({ where: { id: l.id }, data: { renterId: clientId, type: "renter" } }) : null))) ??
      (await prisma.location.create({ data: { name: r.client, type: "renter", renterId: clientId } }));
    for (const l of r.lines) {
      const model = await prisma.model.findFirst({ where: splitVariant(l.model) });
      if (!model) continue;
      let line = await prisma.rentalLine.findFirst({ where: { rentalId: rental.id, modelId: model.id } });
      if (!line) line = await prisma.rentalLine.create({ data: { rentalId: rental.id, modelId: model.id, quantity: l.qty, pricePerDay: l.pricePerDay } });
      const alloc = await prisma.allocation.findFirst({ where: { rentalLineId: line.id } });
      if (!alloc) await prisma.allocation.create({ data: { holderType: "rental", rentalId: rental.id, rentalLineId: line.id, modelId: model.id, quantity: l.qty, startDate: data.startDate, endDate: data.endDate } });
      if ((l as { assign?: boolean }).assign && r.status === "out") {
        // The Phase 1 seed already put these units at the renter; link the first ones.
        const units = await prisma.item.findMany({ where: { modelId: model.id, status: "rented_out" }, take: l.qty });
        if (units[0] && !line.itemId) {
          await prisma.rentalLine.update({ where: { id: line.id }, data: { itemId: units[0].id } });
          await prisma.allocation.updateMany({ where: { rentalLineId: line.id }, data: { itemId: units[0].id } });
        }
        for (const u of units) await prisma.item.update({ where: { id: u.id }, data: { locationId: renterLoc.id } });
      }
    }
  }
  // Drop the Phase 1 placeholder renter location if a proper one now exists.
  const stale = await prisma.location.findMany({ where: { name: "Nordic Light Rental", renterId: null } });
  for (const s of stale) {
    const proper = await prisma.location.findFirst({ where: { renterId: clientIds.get("Nordic Light Rental"), id: { not: s.id } } });
    if (proper) {
      await prisma.item.updateMany({ where: { locationId: s.id }, data: { locationId: proper.id } });
      await prisma.location.delete({ where: { id: s.id } });
    }
  }

  // Home locations for items that have none yet (warehouse zone from Phase 1).
  const items = await prisma.item.findMany({ where: { homeLocationId: null }, include: { location: true, model: { include: { category: true } } } });
  const zones = await prisma.location.findMany({ where: { type: "warehouse" } });
  for (const i of items) {
    const home = i.location?.type === "warehouse" ? i.location.id : zones[0]?.id;
    if (home) await prisma.item.update({ where: { id: i.id }, data: { homeLocationId: home } });
  }

  return { clients: clientIds.size, projects: projectCount, allocations: allocationCount, rentals: rentalCount };
}
