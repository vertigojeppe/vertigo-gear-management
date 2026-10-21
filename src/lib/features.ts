/**
 * Switches for parts of the app Vertigo does not use yet. Hidden, not
 * removed: the data, routes and services stay, so turning a switch back on
 * brings everything back as it was. Server-side only (reads the environment).
 */

/**
 * Gear on projects: the "Reserved gear", "Rent in" and quote sections of a
 * project, the reservation count on the projects list and "from the
 * reservations" when starting a packing list. Off unless PROJECT_GEAR=on.
 */
export function projectGearEnabled(env: string | undefined = process.env.PROJECT_GEAR): boolean {
  return ["on", "1", "true", "yes"].includes((env ?? "").trim().toLowerCase());
}
