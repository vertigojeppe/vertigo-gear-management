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

export const ITEM_STATUSES = [
  { key: "in_house", label: "itemStatus.in_house", color: "green", available: true },
  { key: "on_project", label: "itemStatus.on_project", color: "blue", available: true },
  { key: "rented_out", label: "itemStatus.rented_out", color: "purple", available: true },
  { key: "in_repair", label: "itemStatus.in_repair", color: "amber", available: false },
  { key: "missing", label: "itemStatus.missing", color: "red", available: false },
  { key: "retired", label: "itemStatus.retired", color: "gray", available: false },
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number]["key"];

export const LOCATION_TYPES = ["warehouse", "project", "renter", "repair"] as const;
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

export const RENTAL_STATUSES = [
  { key: "reserved", label: "rentalStatus.reserved", color: "gray" },
  { key: "out", label: "rentalStatus.out", color: "purple" },
  { key: "returned", label: "rentalStatus.returned", color: "green" },
  { key: "overdue", label: "rentalStatus.overdue", color: "red" },
] as const;

export type RentalStatus = (typeof RENTAL_STATUSES)[number]["key"];

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
  },
  {
    key: "thermal_62x29",
    label: "Thermal 62 × 29 mm",
    page: "single",
    columns: 1,
    rows: 1,
    widthMm: 62,
    heightMm: 29,
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
} as const;
