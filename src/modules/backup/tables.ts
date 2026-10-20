/**
 * Every table in the order a restore inserts them (parents before
 * children). The export writes them in the same order; the restore
 * deletes in reverse. Rows of a table that points at itself are sorted so
 * parents come first (`selfRef`). Keep this in step with prisma/models:
 * a model missing here is silently left out of backups, so the test
 * compares the list with the client's model names.
 */
export type TableDef = { name: string; delegate: string; selfRef?: string; /** Primary key column when it is not "id" (Counter uses "key"). */ idField?: string };

export const TABLES: TableDef[] = [
  { name: "User", delegate: "user" },
  { name: "ApiToken", delegate: "apiToken" },
  { name: "CalendarFeedToken", delegate: "calendarFeedToken" },
  { name: "Counter", delegate: "counter", idField: "key" },
  { name: "Webhook", delegate: "webhook" },
  { name: "Outbox", delegate: "outbox" },
  { name: "Contact", delegate: "contact" },
  { name: "File", delegate: "file" },
  { name: "Attachment", delegate: "attachment" },
  { name: "Category", delegate: "category", selfRef: "parentId" },
  { name: "LengthColor", delegate: "lengthColor" },
  { name: "CustomFieldDefinition", delegate: "customFieldDefinition" },
  { name: "Model", delegate: "model" },
  { name: "PartFit", delegate: "partFit" },
  { name: "WishItem", delegate: "wishItem" },
  { name: "Purchase", delegate: "purchase" },
  { name: "SubHireItem", delegate: "subHireItem" },
  { name: "Location", delegate: "location", selfRef: "parentId" },
  { name: "Item", delegate: "item", selfRef: "parentItemId" },
  { name: "StatusLog", delegate: "statusLog" },
  { name: "Client", delegate: "client" },
  { name: "RateTable", delegate: "rateTable" },
  { name: "RateTier", delegate: "rateTier" },
  { name: "Project", delegate: "project" },
  { name: "ProjectContact", delegate: "projectContact" },
  { name: "ProjectCrew", delegate: "projectCrew" },
  { name: "Rental", delegate: "rental" },
  { name: "RentalLine", delegate: "rentalLine" },
  { name: "Allocation", delegate: "allocation" },
  { name: "SubHireLine", delegate: "subHireLine" },
  { name: "ExtraLine", delegate: "extraLine" },
  { name: "PackingTemplate", delegate: "packingTemplate" },
  { name: "PackingTemplateLine", delegate: "packingTemplateLine" },
  { name: "PackingList", delegate: "packingList" },
  { name: "PackingLine", delegate: "packingLine" },
  { name: "PackingCheck", delegate: "packingCheck", selfRef: "outCheckId" },
  { name: "StockMovement", delegate: "stockMovement" },
  { name: "ShareLink", delegate: "shareLink" },
  { name: "PlanTemplate", delegate: "planTemplate" },
  { name: "PlanTemplateEntry", delegate: "planTemplateEntry" },
  { name: "ProductionPlan", delegate: "productionPlan" },
  { name: "ScheduleEntry", delegate: "scheduleEntry" },
  { name: "PlanTask", delegate: "planTask" },
  { name: "LogisticsEntry", delegate: "logisticsEntry" },
  { name: "PlanDocument", delegate: "planDocument" },
  { name: "PlanDocumentVersion", delegate: "planDocumentVersion" },
  { name: "Markup", delegate: "markup" },
  { name: "UploadSession", delegate: "uploadSession" },
  { name: "ActivityLog", delegate: "activityLog" },
];

/** Nullable Json columns: a JSON null in the file must be written as a database NULL, which Prisma needs spelled out. */
export const NULLABLE_JSON: Record<string, string[]> = { ActivityLog: ["details"] };

export type BackupFile = { version: 1; app: string; exportedAt: string; tables: Record<string, Record<string, unknown>[]> };

/** Rows with a parent pointer in the same table, parents first; unknown parents are left in place (the database decides). */
export function sortSelfRefs<T extends Record<string, unknown>>(rows: T[], field: string): T[] {
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const placed = new Set<string>();
  const out: T[] = [];
  const place = (r: T, depth: number) => {
    const id = String(r.id);
    if (placed.has(id)) return;
    const parent = r[field];
    if (parent && byId.has(String(parent)) && depth < 1000) place(byId.get(String(parent))!, depth + 1);
    if (!placed.has(id)) {
      placed.add(id);
      out.push(r);
    }
  };
  for (const r of rows) place(r, 0);
  return out;
}

/** Shape check for an uploaded backup; returns the problems found (empty = valid). */
export function validateBackup(data: unknown): string[] {
  const problems: string[] = [];
  if (!data || typeof data !== "object") return ["Not a JSON object."];
  const d = data as Partial<BackupFile>;
  if (d.version !== 1) problems.push(`Unsupported backup version ${String(d.version)}.`);
  if (!d.tables || typeof d.tables !== "object") return [...problems, "No tables in the file."];
  for (const t of TABLES) {
    const rows = d.tables[t.name];
    if (rows === undefined) continue; // a table added after the backup was taken stays empty
    if (!Array.isArray(rows)) problems.push(`Table ${t.name} is not a list.`);
    else if (rows.some((r) => !r || typeof r !== "object" || typeof (r as Record<string, unknown>)[t.idField ?? "id"] !== "string")) problems.push(`Table ${t.name} has a row without an id.`);
  }
  for (const name of Object.keys(d.tables)) if (!TABLES.some((t) => t.name === name)) problems.push(`Unknown table ${name}.`);
  return problems;
}
