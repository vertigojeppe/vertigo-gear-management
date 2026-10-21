/**
 * Switches for parts of the app Vertigo does not use yet. Hidden, not
 * removed: the data, routes and services stay, so turning a switch back on
 * brings everything back as it was. Server-side only (reads the environment).
 */

/** An environment switch is on for "on", "1", "true" or "yes"; unset or anything else is off. */
export function switchOn(value: string | undefined): boolean {
  return ["on", "1", "true", "yes"].includes((value ?? "").trim().toLowerCase());
}

/**
 * Gear on projects: the "Reserved gear", "Rent in" and quote sections of a
 * project, the reservation count on the projects list and "from the
 * reservations" when starting a packing list. Off unless PROJECT_GEAR=on.
 */
export function projectGearEnabled(): boolean {
  return switchOn(process.env.PROJECT_GEAR);
}
