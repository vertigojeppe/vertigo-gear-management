/**
 * The earliest value each date field of the project form may take, so its
 * calendar opens on the job instead of on today, and a phase cannot start
 * before the one above it. Phases may overlap (prep can run on into
 * build-up), so the floor is the latest phase *start* filled in above; an
 * end field also starts from its own phase's start. Pure.
 */
export type PhaseDateValues = {
  prepStart?: string;
  prepEnd?: string;
  buildStart?: string;
  buildEnd?: string;
  /** datetime-local value, "YYYY-MM-DDTHH:MM" */
  showStart?: string;
  showEnd?: string;
  packStart?: string;
  packEnd?: string;
  returnDate?: string;
};

export type DateFloors = Record<keyof PhaseDateValues, string | undefined>;

export function dateFloors(v: PhaseDateValues): DateFloors {
  const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined);
  const prep = day(v.prepStart);
  const build = day(v.buildStart) ?? prep;
  const show = day(v.showStart) ?? build;
  const pack = day(v.packStart) ?? show;
  const asDateTime = (d?: string) => (d ? `${d}T00:00` : undefined);
  return {
    prepStart: undefined,
    prepEnd: prep,
    buildStart: prep,
    buildEnd: build,
    showStart: asDateTime(build),
    // The show ends after it starts (to the minute), otherwise not before build-up.
    showEnd: v.showStart && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v.showStart) ? v.showStart.slice(0, 16) : asDateTime(build),
    packStart: show,
    packEnd: pack,
    returnDate: pack,
  };
}
