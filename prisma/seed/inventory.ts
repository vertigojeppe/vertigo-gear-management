import type { PrismaClient } from "../../src/generated/prisma/client";
import { formatAssetTag, nextAssetTag } from "../../src/lib/asset-tag";

/**
 * Realistic demo inventory for a Copenhagen light/laser/projection studio.
 * Re-runnable: categories and models are matched by name, items by asset tag.
 */

type Cat = { name: string; children?: Cat[] };

const CATEGORIES: Cat[] = [
  { name: "Video", children: [{ name: "Projectors", children: [{ name: "Laser projectors" }, { name: "Lamp projectors" }] }, { name: "Media servers" }, { name: "LED walls" }, { name: "Video signal" }] },
  { name: "Lighting", children: [{ name: "Moving heads" }, { name: "LED" }, { name: "LED controllers" }, { name: "Conventional" }, { name: "Control" }, { name: "Atmospherics" }] },
  { name: "Laser", children: [{ name: "Laser projectors" }, { name: "Laser control & safety" }] },
  { name: "Audio", children: [{ name: "Speakers" }, { name: "Playback & mixing" }] },
  { name: "Rigging", children: [{ name: "Truss" }, { name: "Alu profiles" }, { name: "Clamps & hardware" }, { name: "Motors & hoists" }, { name: "Stands" }] },
  { name: "Cables", children: [{ name: "Power" }, { name: "Signal", children: [{ name: "DMX" }, { name: "SDI" }, { name: "HDMI" }, { name: "Ethernet" }, { name: "XLR" }] }] },
  { name: "Cases & storage" },
  { name: "Computers & networking" },
];

type ModelSeed = {
  cat: string; // leaf category path "Video/Projectors/Laser projectors"
  mfr: string;
  name: string;
  tracking?: "bulk";
  kg?: number;
  w?: number;
  h?: number;
  d?: number;
  watts?: number;
  desc?: string;
  /** Serialized: number of units. Bulk: quantity in the main bin. */
  units: number;
  price?: number;
  /** Rental day price excl. VAT (default: 1% of the purchase price). */
  day?: number;
};

const MODELS: ModelSeed[] = [
  // Video
  { cat: "Video/Projectors/Laser projectors", mfr: "Panasonic", name: "PT-RZ120", kg: 24, w: 58, h: 20, d: 59, watts: 800, units: 4, price: 68000, desc: "12,000 lm WUXGA laser" },
  { cat: "Video/Projectors/Laser projectors", mfr: "Panasonic", name: "PT-RZ21K", kg: 49, w: 60, h: 25, d: 66, watts: 1800, units: 2, price: 220000, desc: "20,000 lm WUXGA laser" },
  { cat: "Video/Projectors/Laser projectors", mfr: "Epson", name: "EB-L1755U", kg: 24, watts: 900, units: 2, price: 95000 },
  { cat: "Video/Projectors/Laser projectors", mfr: "Barco", name: "G62-W11", kg: 24, watts: 800, units: 2, price: 110000 },
  { cat: "Video/Projectors/Laser projectors", mfr: "Christie", name: "DWU1100-GS", kg: 28, watts: 1000, units: 1, price: 125000 },
  { cat: "Video/Projectors/Lamp projectors", mfr: "Panasonic", name: "PT-EZ590", kg: 9, watts: 450, units: 3, price: 18000 },
  { cat: "Video/Projectors/Lamp projectors", mfr: "Panasonic", name: "ET-DLE085 lens 0.8", kg: 1.5, units: 3, price: 12000 },
  { cat: "Video/Projectors/Lamp projectors", mfr: "Panasonic", name: "ET-DLE250 lens 2.3-3.6", kg: 1.3, units: 2, price: 14000 },
  { cat: "Video/Media servers", mfr: "disguise", name: "vx 2", kg: 16, watts: 650, units: 1, price: 180000, desc: "4K media server, 4 outputs" },
  { cat: "Video/Media servers", mfr: "", name: "Resolume server (custom)", kg: 14, watts: 600, units: 2, price: 45000, desc: "Ryzen 9 / RTX 4080, Resolume Arena 7" },
  { cat: "Video/Media servers", mfr: "Dataton", name: "WATCHPAX 60", kg: 3, watts: 120, units: 2, price: 52000 },
  { cat: "Video/Media servers", mfr: "Blackmagic", name: "UltraStudio 4K Mini", kg: 1, units: 2, price: 8000 },
  { cat: "Video/LED walls", mfr: "ROE Visual", name: "Black Pearl BP2 panel", tracking: "bulk", kg: 8, w: 50, h: 50, d: 7, watts: 150, units: 60, price: 9000, desc: "2.84 mm indoor LED panel" },
  { cat: "Video/LED walls", mfr: "Brompton", name: "SX40 processor", kg: 4, watts: 100, units: 2, price: 95000 },
  { cat: "Video/LED walls", mfr: "Brompton", name: "XD 10G distribution", kg: 3, units: 2, price: 28000 },
  { cat: "Video/Video signal", mfr: "Blackmagic", name: "ATEM Mini Extreme ISO", kg: 1.5, units: 1, price: 10000 },
  { cat: "Video/Video signal", mfr: "Decimator", name: "MD-HX", kg: 0.3, units: 6, price: 3200 },
  { cat: "Video/Video signal", mfr: "Lightware", name: "MX2-8x8-HDMI20", kg: 4, units: 1, price: 45000 },
  { cat: "Video/Video signal", mfr: "Blackmagic", name: "Smart Videohub 20x20", kg: 3, units: 1, price: 12000 },
  { cat: "Video/Video signal", mfr: "Datapath", name: "Fx4 SDI", kg: 1.2, units: 2, price: 15000 },
  // Lighting
  { cat: "Lighting/Moving heads", mfr: "Robe", name: "Pointe", kg: 15, watts: 470, units: 8, price: 55000, day: 400 },
  { cat: "Lighting/Moving heads", mfr: "Robe", name: "Esprite", kg: 28, watts: 900, units: 4, price: 95000 },
  { cat: "Lighting/Moving heads", mfr: "Martin", name: "MAC Aura XB", kg: 6.5, watts: 320, units: 12, price: 22000 },
  { cat: "Lighting/Moving heads", mfr: "Ayrton", name: "Diablo", kg: 11, watts: 400, units: 6, price: 65000 },
  { cat: "Lighting/Moving heads", mfr: "GLP", name: "JDC1", kg: 14, watts: 1200, units: 6, price: 38000 },
  { cat: "Lighting/LED", mfr: "Astera", name: "Titan Tube (set of 8)", kg: 12, units: 3, price: 42000, desc: "Case of 8 tubes with charger" },
  { cat: "Lighting/LED", mfr: "Astera", name: "AX5 TriplePAR", kg: 3.5, units: 8, price: 7500 },
  { cat: "Lighting/LED", mfr: "Chauvet", name: "COLORado Solo Batten 4", kg: 7, watts: 180, units: 10, price: 9000 },
  { cat: "Lighting/LED", mfr: "ETC", name: "ColorSource PAR", kg: 5, watts: 120, units: 12, price: 6500 },
  { cat: "Lighting/LED", mfr: "SGM", name: "P-5", kg: 7, watts: 320, units: 6, price: 16000 },
  { cat: "Lighting/Conventional", mfr: "ETC", name: "Source Four LED S3 Lustr", kg: 8, watts: 170, units: 6, price: 18000 },
  { cat: "Lighting/Conventional", mfr: "Martin", name: "Atomic 3000 LED", kg: 7.5, watts: 500, units: 4, price: 14000 },
  { cat: "Lighting/Control", mfr: "MA Lighting", name: "grandMA3 onPC command wing", kg: 9, units: 1, price: 65000 },
  { cat: "Lighting/Control", mfr: "MA Lighting", name: "grandMA3 2Port Node", kg: 0.8, units: 3, price: 7000 },
  { cat: "Lighting/Control", mfr: "ChamSys", name: "MagicQ MQ70", kg: 6, units: 1, price: 40000 },
  { cat: "Lighting/Control", mfr: "Enttec", name: "ODE Mk3", kg: 0.4, units: 4, price: 2200 },
  { cat: "Lighting/Atmospherics", mfr: "MDG", name: "ATMe haze generator", kg: 15, watts: 700, units: 2, price: 38000 },
  { cat: "Lighting/Atmospherics", mfr: "Look Solutions", name: "Unique 2.1", kg: 8, watts: 1500, units: 2, price: 14000 },
  // Laser
  { cat: "Laser/Laser projectors", mfr: "Kvant", name: "Clubmax 6000 FB4", kg: 12, watts: 500, units: 4, price: 85000, desc: "6 W RGB, FB4 built in" },
  { cat: "Laser/Laser projectors", mfr: "Kvant", name: "Atom 20", kg: 25, watts: 800, units: 2, price: 220000, desc: "20 W RGB" },
  { cat: "Laser/Laser projectors", mfr: "Kvant", name: "Spectrum 10", kg: 18, watts: 600, units: 2, price: 150000 },
  { cat: "Laser/Laser control & safety", mfr: "Pangolin", name: "FB4 external", kg: 0.5, units: 4, price: 6000 },
  { cat: "Laser/Laser control & safety", mfr: "Pangolin", name: "Beyond Ultimate license key", kg: 0.1, units: 2, price: 18000 },
  { cat: "Laser/Laser control & safety", mfr: "Kvant", name: "Safety interlock key", kg: 0.1, units: 6, price: 400 },
  { cat: "Laser/Laser control & safety", mfr: "Kvant", name: "E-stop remote", kg: 0.6, units: 3, price: 2500 },
  { cat: "Laser/Laser control & safety", mfr: "Laserworld", name: "Beam block set", tracking: "bulk", kg: 1, units: 12, price: 600 },
  // Audio
  { cat: "Audio/Speakers", mfr: "d&b audiotechnik", name: "E8", kg: 11, units: 4, price: 22000 },
  { cat: "Audio/Playback & mixing", mfr: "Allen & Heath", name: "SQ-5", kg: 10, watts: 100, units: 1, price: 28000 },
  { cat: "Audio/Playback & mixing", mfr: "Focusrite", name: "Scarlett 18i20", kg: 3, units: 2, price: 5000 },
  // Rigging
  { cat: "Rigging/Truss", mfr: "Prolyte", name: "H30V 2 m", tracking: "bulk", kg: 8, units: 16, price: 2200 },
  { cat: "Rigging/Truss", mfr: "Prolyte", name: "H30V 3 m", tracking: "bulk", kg: 11, units: 12, price: 3000 },
  { cat: "Rigging/Truss", mfr: "Prolyte", name: "H30V corner C012", tracking: "bulk", kg: 6, units: 8, price: 2800 },
  { cat: "Rigging/Clamps & hardware", mfr: "Doughty", name: "Half coupler 50 mm", tracking: "bulk", kg: 0.5, units: 120, price: 180 },
  { cat: "Rigging/Clamps & hardware", mfr: "Doughty", name: "Trigger clamp", tracking: "bulk", kg: 0.6, units: 60, price: 260 },
  { cat: "Rigging/Clamps & hardware", mfr: "", name: "Safety wire 3 mm 1 m", tracking: "bulk", kg: 0.2, units: 150, price: 90 },
  { cat: "Rigging/Motors & hoists", mfr: "CM", name: "Lodestar D8+ 1 t", kg: 60, watts: 1100, units: 4, price: 32000 },
  { cat: "Rigging/Motors & hoists", mfr: "", name: "Motor controller 4-way", kg: 12, units: 1, price: 18000 },
  { cat: "Rigging/Stands", mfr: "Manfrotto", name: "Wind-up stand 087NWB", kg: 11, units: 6, price: 2800 },
  // Cables
  { cat: "Cables/Power", mfr: "Neutrik", name: "powerCON TRUE1 link 5 m", tracking: "bulk", kg: 0.8, units: 40, price: 350 },
  { cat: "Cables/Power", mfr: "Neutrik", name: "powerCON TRUE1 link 10 m", tracking: "bulk", kg: 1.4, units: 25, price: 500 },
  { cat: "Cables/Power", mfr: "", name: "CEE 16 A 25 m", tracking: "bulk", kg: 6, units: 10, price: 900 },
  { cat: "Cables/Power", mfr: "", name: "CEE 32 A 25 m", tracking: "bulk", kg: 9, units: 6, price: 1500 },
  { cat: "Cables/Signal/DMX", mfr: "", name: "DMX 5-pin 5 m", tracking: "bulk", kg: 0.3, units: 40, price: 180 },
  { cat: "Cables/Signal/DMX", mfr: "", name: "DMX 5-pin 10 m", tracking: "bulk", kg: 0.5, units: 30, price: 260 },
  { cat: "Cables/Signal/DMX", mfr: "", name: "DMX 5-pin 25 m", tracking: "bulk", kg: 1.2, units: 12, price: 500 },
  { cat: "Cables/Signal/SDI", mfr: "", name: "SDI BNC 10 m", tracking: "bulk", kg: 0.6, units: 20, price: 300 },
  { cat: "Cables/Signal/SDI", mfr: "", name: "SDI BNC 25 m", tracking: "bulk", kg: 1.3, units: 12, price: 550 },
  { cat: "Cables/Signal/SDI", mfr: "", name: "SDI BNC 50 m", tracking: "bulk", kg: 2.5, units: 6, price: 950 },
  { cat: "Cables/Signal/HDMI", mfr: "", name: "HDMI 2.0 fibre 30 m", tracking: "bulk", kg: 0.8, units: 4, price: 1600 },
  { cat: "Cables/Signal/Ethernet", mfr: "", name: "Cat6A shielded 20 m", tracking: "bulk", kg: 1, units: 15, price: 350 },
  { cat: "Cables/Signal/Ethernet", mfr: "", name: "Cat6A shielded 50 m", tracking: "bulk", kg: 2.5, units: 8, price: 700 },
  { cat: "Cables/Signal/XLR", mfr: "", name: "XLR 3-pin 5 m", tracking: "bulk", kg: 0.3, units: 30, price: 150 },
  { cat: "Cables/Signal/XLR", mfr: "", name: "XLR 3-pin 10 m", tracking: "bulk", kg: 0.5, units: 20, price: 220 },
  // Cases
  { cat: "Cases & storage", mfr: "", name: "Flight case 120×60×60", kg: 28, w: 120, h: 60, d: 60, units: 6, price: 6500 },
  { cat: "Cases & storage", mfr: "", name: "Flight case 80×60×50", kg: 20, w: 80, h: 60, d: 50, units: 6, price: 5000 },
  { cat: "Cases & storage", mfr: "Peli", name: "1650", kg: 11, w: 80, h: 52, d: 32, units: 4, price: 3500 },
  { cat: "Cases & storage", mfr: "", name: "Cable trunk 100×60", kg: 25, units: 4, price: 5500 },
  // Computers & networking
  { cat: "Computers & networking", mfr: "Apple", name: "MacBook Pro 16 M3 Max", kg: 2.2, units: 2, price: 42000 },
  { cat: "Computers & networking", mfr: "Netgear", name: "GS308 switch", kg: 0.5, units: 4, price: 450 },
  { cat: "Computers & networking", mfr: "Netgear", name: "M4250-10G2F-PoE+ AV switch", kg: 3, units: 2, price: 9500 },
  { cat: "Computers & networking", mfr: "Ubiquiti", name: "UniFi U6 Pro", kg: 0.4, units: 3, price: 1800 },
  { cat: "Computers & networking", mfr: "Teltonika", name: "RUT241 4G router", kg: 0.3, units: 2, price: 1900 },
];

type LocationSeed = { name: string; type: "warehouse" | "project" | "renter" | "repair"; parent?: string; notes?: string };

const LOCATIONS: LocationSeed[] = [
  { name: "Warehouse", type: "warehouse", notes: "Refshalevej, hall B" },
  { name: "Zone A – Video", type: "warehouse", parent: "Warehouse" },
  { name: "Zone B – Lighting", type: "warehouse", parent: "Warehouse" },
  { name: "Zone C – Laser", type: "warehouse", parent: "Warehouse" },
  { name: "Zone D – Rigging", type: "warehouse", parent: "Warehouse" },
  { name: "Cable wall", type: "warehouse", parent: "Warehouse" },
  { name: "Case row", type: "warehouse", parent: "Warehouse" },
  { name: "Office", type: "warehouse" },
  { name: "AV Service Copenhagen", type: "repair", notes: "Projector and laser service partner" },
  // Created here so items can sit on them; the project and rental seeds
  // adopt them (projectId / renterId) and this seed then leaves them alone.
  { name: "Roskilde Festival – Orange stage", type: "project" },
  { name: "Nordic Light Rental", type: "renter" },
];

function zoneFor(catPath: string): string {
  if (catPath.startsWith("Video")) return "Zone A – Video";
  if (catPath.startsWith("Lighting")) return "Zone B – Lighting";
  if (catPath.startsWith("Laser")) return "Zone C – Laser";
  if (catPath.startsWith("Rigging")) return "Zone D – Rigging";
  if (catPath.startsWith("Cables")) return "Cable wall";
  if (catPath.startsWith("Cases")) return "Case row";
  return "Office";
}

/** Deterministic pseudo-random so the seed is stable between runs. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export async function seedInventory(prisma: PrismaClient) {
  // Categories
  const catIds = new Map<string, string>();
  async function upsertCats(list: Cat[], parentPath: string | null, parentId: string | null) {
    let order = 0;
    for (const c of list) {
      const path = parentPath ? `${parentPath}/${c.name}` : c.name;
      const existing = await prisma.category.findFirst({ where: { name: c.name, parentId } });
      const row = existing
        ? await prisma.category.update({ where: { id: existing.id }, data: { sortOrder: order } })
        : await prisma.category.create({ data: { name: c.name, parentId, sortOrder: order } });
      catIds.set(path, row.id);
      if (c.children) await upsertCats(c.children, path, row.id);
      order++;
    }
  }
  await upsertCats(CATEGORIES, null, null);

  // Locations
  const locIds = new Map<string, string>();
  for (const l of LOCATIONS) {
    const parentId = l.parent ? (locIds.get(l.parent) ?? null) : null;
    const existing = await prisma.location.findFirst({ where: { name: l.name } });
    const adopted = Boolean(existing?.projectId || existing?.renterId);
    const row = existing
      ? adopted
        ? existing
        : await prisma.location.update({ where: { id: existing.id }, data: { type: l.type, parentId, notes: l.notes ?? null } })
      : await prisma.location.create({ data: { name: l.name, type: l.type, parentId, notes: l.notes ?? null } });
    locIds.set(l.name, row.id);
  }

  // Older seeds left a "Placeholder until ... (Phase 2)" note on these rows.
  await prisma.location.updateMany({ where: { notes: { startsWith: "Placeholder until" } }, data: { notes: null } });

  // Models and items
  const random = rng(42);
  let tagNo = 0;
  let modelCount = 0;
  let itemCount = 0;
  const createdItems: { modelName: string; ids: string[] }[] = [];

  for (const m of MODELS) {
    const categoryId = catIds.get(m.cat);
    if (!categoryId) throw new Error(`Unknown category path ${m.cat}`);
    const existing = await prisma.model.findFirst({ where: { manufacturer: m.mfr, name: m.name } });
    const data = {
      categoryId,
      manufacturer: m.mfr,
      name: m.name,
      trackingType: m.tracking ?? "serialized",
      description: m.desc ?? null,
      weightKg: m.kg ?? null,
      rentalDayPrice: m.day ?? (m.price ? Math.round(m.price / 100) : null),
      widthCm: m.w ?? null,
      heightCm: m.h ?? null,
      depthCm: m.d ?? null,
      powerDrawW: m.watts ?? null,
    };
    const model = existing ? await prisma.model.update({ where: { id: existing.id }, data }) : await prisma.model.create({ data });
    modelCount++;

    const locationId = locIds.get(zoneFor(m.cat))!;
    const ids: string[] = [];
    const unitCount = m.tracking === "bulk" ? 1 : m.units;
    for (let n = 0; n < unitCount; n++) {
      tagNo++;
      const assetTag = formatAssetTag(tagNo);
      const year = 2019 + Math.floor(random() * 7);
      const month = 1 + Math.floor(random() * 12);
      const row = await prisma.item.upsert({
        where: { assetTag },
        update: { modelId: model.id, quantity: m.tracking === "bulk" ? m.units : 1 },
        create: {
          modelId: model.id,
          assetTag,
          serialNumber: m.tracking === "bulk" ? null : `${m.mfr.slice(0, 2).toUpperCase()}${year}${String(1000 + Math.floor(random() * 9000))}`,
          quantity: m.tracking === "bulk" ? m.units : 1,
          status: "in_house",
          locationId,
          purchaseDate: new Date(Date.UTC(year, month - 1, 1 + Math.floor(random() * 27))),
          purchasePrice: m.price ?? null,
          supplier: random() > 0.5 ? "Stouenborg" : "Soundware",
          insuredValue: m.price ? Math.round(m.price * 0.9) : null,
          replacementValue: m.price ? Math.round(m.price * 1.1) : null,
          statusLogs: { create: { fromStatus: null, toStatus: "in_house", reason: "Imported" } },
        },
      });
      ids.push(row.id);
      itemCount++;
    }
    createdItems.push({ modelName: m.name, ids });
  }

  // Counter must be past the highest seeded tag.
  const counter = await prisma.counter.findUnique({ where: { key: "asset_tag" } });
  if (!counter || counter.value < tagNo) {
    await prisma.counter.upsert({ where: { key: "asset_tag" }, create: { key: "asset_tag", value: tagNo }, update: { value: tagNo } });
  }

  // The counter must sit past the highest tag in the database, including
  // tags created by earlier seed runs or by users since.
  const allTags = await prisma.item.findMany({ select: { assetTag: true } });
  const highest = allTags.reduce((max, { assetTag }) => Math.max(max, Number(assetTag.split("-").pop()) || 0), tagNo);
  await prisma.counter.upsert({ where: { key: "asset_tag" }, create: { key: "asset_tag", value: highest }, update: { value: { set: highest } } });

  // Kits: three cases with real contents.
  const byModel = (name: string) => createdItems.find((c) => c.modelName === name)?.ids ?? [];
  const caseIds = byModel("Flight case 120×60×60");
  const smallCaseIds = byModel("Flight case 80×60×50");

  const kits: { caseId: string; name: string; contents: string[]; bulk?: { modelName: string; qty: number }[] }[] = [
    { caseId: caseIds[0], name: "Laser case 1", contents: [byModel("Clubmax 6000 FB4")[0], byModel("Safety interlock key")[0], byModel("E-stop remote")[0]], bulk: [{ modelName: "DMX 5-pin 5 m", qty: 3 }, { modelName: "powerCON TRUE1 link 5 m", qty: 2 }] },
    { caseId: caseIds[1], name: "Laser case 2", contents: [byModel("Clubmax 6000 FB4")[1], byModel("Safety interlock key")[1], byModel("E-stop remote")[1]], bulk: [{ modelName: "DMX 5-pin 5 m", qty: 3 }, { modelName: "powerCON TRUE1 link 5 m", qty: 2 }] },
    { caseId: smallCaseIds[0], name: "Projector rig A", contents: [byModel("PT-RZ120")[0], byModel("PT-RZ120")[1], byModel("MD-HX")[0], byModel("MD-HX")[1]], bulk: [{ modelName: "SDI BNC 25 m", qty: 2 }] },
  ];

  for (const k of kits) {
    if (!k.caseId) continue;
    const kit = await prisma.item.update({ where: { id: k.caseId }, data: { isKit: true, name: k.name } });
    for (const id of k.contents.filter(Boolean)) {
      await prisma.item.update({ where: { id }, data: { parentItemId: kit.id, locationId: kit.locationId } });
    }
    for (const b of k.bulk ?? []) {
      // The seed's own model (same manufacturer + name), not an imported one that happens to share the name.
      const seedModel = MODELS.find((x) => x.name === b.modelName);
      const model = await prisma.model.findFirst({ where: { manufacturer: seedModel?.mfr ?? "", name: b.modelName } });
      if (!model) continue;
      const existingBin = await prisma.item.findFirst({ where: { modelId: model.id, parentItemId: kit.id } });
      if (existingBin) continue;
      const mainBin = await prisma.item.findFirst({ where: { modelId: model.id, parentItemId: null } });
      // A fresh tag from the counter, which now sits past every tag in the database (imported ones included).
      await prisma.item.create({
        data: { modelId: model.id, assetTag: await nextAssetTag(prisma), quantity: b.qty, status: "in_house", locationId: kit.locationId, parentItemId: kit.id, statusLogs: { create: { toStatus: "in_house", reason: "Imported" } } },
      });
      if (mainBin) await prisma.item.update({ where: { id: mainBin.id }, data: { quantity: Math.max(0, mainBin.quantity - b.qty) } });
      itemCount++;
    }
  }

  // A few items in other statuses so the dashboard has something to show.
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  const setStatus = async (id: string | undefined, status: string, reason: string, locationName?: string) => {
    if (!id) return;
    const cur = await prisma.item.findUnique({ where: { id } });
    if (!cur || cur.status === status) return;
    await prisma.item.update({ where: { id }, data: { status, locationId: locationName ? locIds.get(locationName) : cur.locationId } });
    await prisma.statusLog.create({ data: { itemId: id, fromStatus: cur.status, toStatus: status, reason, userId: admin?.id } });
  };
  await setStatus(byModel("Pointe")[0], "in_repair", "Pan motor noisy, sent for service", "AV Service Copenhagen");
  await setStatus(byModel("MAC Aura XB")[3], "missing", "Not returned after Distortion 2026");
  await setStatus(byModel("PT-EZ590")[2], "retired", "Lamp hours exceeded, kept for parts");
  for (const id of byModel("MAC Aura XB").slice(4, 10)) await setStatus(id, "on_project", "Checked out", "Roskilde Festival – Orange stage");
  for (const id of byModel("JDC1").slice(0, 4)) await setStatus(id, "on_project", "Checked out", "Roskilde Festival – Orange stage");
  await setStatus(byModel("Atom 20")[0], "rented_out", "Rental", "Nordic Light Rental");
  await setStatus(byModel("Lodestar D8+ 1 t")[0], "rented_out", "Rental", "Nordic Light Rental");
  await setStatus(byModel("Lodestar D8+ 1 t")[1], "rented_out", "Rental", "Nordic Light Rental");

  return { categories: catIds.size, locations: locIds.size, models: modelCount, items: itemCount, kits: kits.length };
}
