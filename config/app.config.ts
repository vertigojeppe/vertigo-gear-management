/**
 * Application configuration.
 *
 * Everything in here is something Vertigo might want to change without
 * touching application code: statuses, phases, roles, label sizes, currency,
 * timezone. Keys are stable identifiers stored in the database; labels are
 * translation keys resolved through messages/<locale>.json.
 *
 * Rule: no component or service hardcodes one of these values. Import from
 * here instead.
 */

export const appConfig = {
  name: "Vertigo Gear",
  timezone: "Europe/Copenhagen",
  defaultLocale: "en",
  locales: ["en", "da"],
  currency: "DKK",
  /** VAT rate applied when showing rental totals incl. VAT. */
  vatRate: 0.25,
  dateFormat: "dd.MM.yyyy",
  timeFormat: "HH:mm",
  /** Prefix for generated asset tags: VG-0001, VG-0002, ... */
  assetTagPrefix: "VG",
  /** Rows per page in list views. */
  pageSize: 50,
} as const;

export type Locale = (typeof appConfig.locales)[number];

/* ---------------------------------------------------------------------- */
/* Roles and permissions                                                  */
/* ---------------------------------------------------------------------- */

export const PERMISSIONS = [
  "inventory.read",
  "inventory.write",
  /** Purchase prices, insured and replacement values. */
  "inventory.finance",
  "projects.read",
  "projects.write",
  "packing.read",
  "packing.write",
  "plans.read",
  "plans.write",
  "rentals.read",
  "rentals.write",
  "contacts.read",
  "contacts.write",
  "files.write",
  "share.create",
  "users.manage",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = {
  admin: {
    label: "roles.admin",
    permissions: [...PERMISSIONS] as Permission[],
  },
  member: {
    label: "roles.member",
    permissions: PERMISSIONS.filter(
      (p) => p !== "users.manage" && p !== "settings.manage",
    ) as Permission[],
  },
  viewer: {
    label: "roles.viewer",
    permissions: PERMISSIONS.filter((p) => p.endsWith(".read")) as Permission[],
  },
} as const satisfies Record<string, { label: string; permissions: Permission[] }>;

export type Role = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as Role[];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && value in ROLES;
}

/* ---------------------------------------------------------------------- */
/* Inventory                                                              */
/* ---------------------------------------------------------------------- */

/**
 * Item statuses. `available` = counts towards availability for projects.
 * `reasonRequired` = a reason must be given when moving an item here.
 * `manual` = can be chosen by hand; false means only flows (check-out,
 * rental) set it.
 */
export const ITEM_STATUSES = [
  { key: "in_house", label: "itemStatus.in_house", color: "green", available: true, reasonRequired: false, manual: true },
  { key: "on_project", label: "itemStatus.on_project", color: "blue", available: true, reasonRequired: false, manual: true },
  { key: "rented_out", label: "itemStatus.rented_out", color: "purple", available: true, reasonRequired: false, manual: true },
  { key: "in_repair", label: "itemStatus.in_repair", color: "amber", available: false, reasonRequired: true, manual: true },
  /** Exists but is not usable yet (own-built LED fixtures). */
  { key: "under_construction", label: "itemStatus.under_construction", color: "amber", available: false, reasonRequired: false, manual: true },
  { key: "missing", label: "itemStatus.missing", color: "red", available: false, reasonRequired: true, manual: true },
  { key: "retired", label: "itemStatus.retired", color: "gray", available: false, reasonRequired: true, manual: true },
] as const;

export const ITEM_STATUS_KEYS = ITEM_STATUSES.map((s) => s.key);
export function itemStatus(key: string) {
  return ITEM_STATUSES.find((s) => s.key === key);
}

export const ATTACHMENT_KINDS = ["photo", "invoice", "manual", "other"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export type ItemStatus = (typeof ITEM_STATUSES)[number]["key"];

/** Why an item was retired; stored on the item next to the free-text reason. */
export const RETIREMENT_REASONS = ["sold", "scrapped", "lost"] as const;
export type RetirementReason = (typeof RETIREMENT_REASONS)[number];

/** person = a staff member (User) or a Contact holding gear ("Mikkel has 2"). */
export const LOCATION_TYPES = ["warehouse", "person", "project", "renter", "repair"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

/* ---------------------------------------------------------------------- */
/* Projects and rentals                                                   */
/* ---------------------------------------------------------------------- */

export const PROJECT_STATUSES = [
  { key: "quote", label: "projectStatus.quote", color: "gray" },
  { key: "confirmed", label: "projectStatus.confirmed", color: "blue" },
  { key: "in_progress", label: "projectStatus.in_progress", color: "green" },
  { key: "done", label: "projectStatus.done", color: "gray" },
  { key: "cancelled", label: "projectStatus.cancelled", color: "red" },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["key"];

/** Phases become calendar events and group the production plan schedule. */
export const PROJECT_PHASES = [
  { key: "prep", label: "phase.prep" },
  { key: "load_in", label: "phase.load_in" },
  { key: "show", label: "phase.show" },
  { key: "load_out", label: "phase.load_out" },
  { key: "return", label: "phase.return" },
] as const;

export type ProjectPhase = (typeof PROJECT_PHASES)[number]["key"];

/** Which project date fields make up each phase (for calendar events). */
export const PHASE_DATES: Record<ProjectPhase, { start: string; end?: string }> = {
  prep: { start: "prepStart", end: "loadIn" },
  load_in: { start: "loadIn" },
  show: { start: "showStart", end: "showEnd" },
  load_out: { start: "loadOut" },
  return: { start: "returnDate" },
};

/** How a rate table continues beyond its last tier. */
export const RATE_EXTRA_RULES = [
  { key: "none", label: "rateExtraRule.none" },
  { key: "per_day", label: "rateExtraRule.per_day" },
  { key: "per_10_days", label: "rateExtraRule.per_10_days" },
] as const;
export type RateExtraRule = (typeof RATE_EXTRA_RULES)[number]["key"];

export const RENTAL_STATUSES = [
  { key: "reserved", label: "rentalStatus.reserved", color: "gray" },
  { key: "out", label: "rentalStatus.out", color: "purple" },
  { key: "returned", label: "rentalStatus.returned", color: "green" },
  { key: "overdue", label: "rentalStatus.overdue", color: "red" },
] as const;

export type RentalStatus = (typeof RENTAL_STATUSES)[number]["key"];

/* ---------------------------------------------------------------------- */
/* Integrations                                                           */
/* ---------------------------------------------------------------------- */

/** Events that outgoing webhooks can subscribe to. */
export const WEBHOOK_EVENTS = [
  "item.status_changed",
  "project.created",
  "project.confirmed",
  "project.updated",
  "project.cancelled",
  "rental.created",
  "rental.out",
  "rental.returned",
  "packing.checked_out",
  "packing.checked_in",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const outboxConfig = {
  /** Poll interval of the in-process worker (ms). */
  pollMs: 15_000,
  /** Give up after this many failed attempts. */
  maxAttempts: 8,
  /** Backoff base: attempt n waits base * 2^n seconds. */
  backoffBaseSeconds: 30,
} as const;

/* ---------------------------------------------------------------------- */
/* Packing                                                                */
/* ---------------------------------------------------------------------- */

export const PACKING_STATUSES = [
  { key: "draft", label: "packingStatus.draft", color: "gray" },
  { key: "checked_out", label: "packingStatus.checked_out", color: "blue" },
  { key: "checked_in", label: "packingStatus.checked_in", color: "green" },
] as const;
export type PackingStatus = (typeof PACKING_STATUSES)[number]["key"];

/** What can happen to a unit at check-in, and the item status it leads to. */
export const CHECK_OUTCOMES = [
  { key: "ok", label: "checkOutcome.ok", itemStatus: "in_house", color: "green" },
  { key: "damaged", label: "checkOutcome.damaged", itemStatus: "in_repair", color: "amber" },
  { key: "missing", label: "checkOutcome.missing", itemStatus: "missing", color: "red" },
] as const;
export type CheckOutcome = (typeof CHECK_OUTCOMES)[number]["key"];

export const PACKING_GROUPINGS = ["category", "case"] as const;
export type PackingGrouping = (typeof PACKING_GROUPINGS)[number];

/* ---------------------------------------------------------------------- */
/* Labels                                                                 */
/* ---------------------------------------------------------------------- */

export const LABEL_SIZES = [
  {
    key: "avery_l7160",
    label: "Avery L7160 (63.5 × 38.1 mm, 21 per A4)",
    page: "A4",
    columns: 3,
    rows: 7,
    widthMm: 63.5,
    heightMm: 38.1,
    /** Space between labels; the grid is centred on the page, which gives Avery's own margins. */
    gapXMm: 2.5,
    gapYMm: 0,
  },
  {
    key: "thermal_62x29",
    label: "Thermal 62 × 29 mm",
    page: "single",
    columns: 1,
    rows: 1,
    widthMm: 62,
    heightMm: 29,
    gapXMm: 0,
    gapYMm: 0,
  },
] as const;

export type LabelSizeKey = (typeof LABEL_SIZES)[number]["key"];

/* ---------------------------------------------------------------------- */
/* Files                                                                  */
/* ---------------------------------------------------------------------- */

export const fileConfig = {
  /** Default per-file upload limit; override with MAX_UPLOAD_MB. */
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 500) * 1024 * 1024,
  inlineViewers: {
    image: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
    pdf: ["application/pdf"],
    model3d: [".glb", ".gltf", ".obj", ".stl"],
  },
  /** Stored and downloadable, shown with an icon and an optional preview image. */
  nativeOnly: [".skp", ".blend", ".dwg", ".dxf", ".vwx", ".ai", ".psd"],
  /** Resumable upload chunk size (bytes). */
  chunkBytes: 4 * 1024 * 1024,
  /** Unfinished uploads are discarded after this many hours. */
  uploadSessionHours: 24,
} as const;

export const MARKUP_TOOLS = ["select", "pen", "arrow", "rect", "text"] as const;
export type MarkupTool = (typeof MARKUP_TOOLS)[number];
export const MARKUP_COLORS = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#111111"] as const;

/* ---------------------------------------------------------------------- */
/* Production plans                                                       */
/* ---------------------------------------------------------------------- */

/** Task phases, in display order. */
export const PLAN_PHASES = ["pre_production", "build", "show", "post"] as const;
export type PlanPhase = (typeof PLAN_PHASES)[number];

export const LOGISTICS_KINDS = ["vehicle", "parking", "loading", "hotel", "travel", "other"] as const;
export type LogisticsKind = (typeof LOGISTICS_KINDS)[number];

/** What a plan template entry becomes when applied. */
export const PLAN_ENTRY_KINDS = ["schedule", "task", "logistics"] as const;
export type PlanEntryKind = (typeof PLAN_ENTRY_KINDS)[number];
