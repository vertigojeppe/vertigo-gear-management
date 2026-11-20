/** Setup times: the pure parts. */

export type SetupRule = { baseHours: number | null; minutesPerUnit: number | null; ruleCrew: number | null };

/**
 * Hours a rule of thumb gives for `units` with `crew` people: base hours plus
 * minutes per unit, scaled from the rule's crew to this one (the person-hours
 * stay the same, so twice the people take half the time). Null when the rule
 * has no numbers, or counts per unit and the units are unknown.
 * shortcut: crew scales linearly, which flatters big crews; refine once debriefs show how it really scales.
 */
export function ruleEstimate(rule: SetupRule, units: number | null, crew: number | null): number | null {
  if (rule.baseHours === null && rule.minutesPerUnit === null) return null;
  if (rule.minutesPerUnit !== null && units === null) return null;
  const hours = (rule.baseHours ?? 0) + ((rule.minutesPerUnit ?? 0) * (units ?? 0)) / 60;
  const scale = rule.ruleCrew && crew ? rule.ruleCrew / crew : 1;
  return Math.round(hours * scale * 10) / 10;
}
