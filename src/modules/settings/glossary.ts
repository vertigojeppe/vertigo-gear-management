import { cache } from "react";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { buildGlossary, parseGlossaryText, type Glossary } from "@/lib/search";
import { SettingsError } from "./service";

/**
 * Settings › Search words: groups of words that mean the same, so a search
 * for one finds the others ("arbejdslys" → "Worklight"). Edited as text,
 * one group per line; saving replaces the whole list. Searches load it once
 * per request (`glossary.load`).
 */
export const glossary = {
  /** The groups as stored, for the gear picker (which builds the lookup in the browser). */
  groups: cache(async (): Promise<string[][]> => (await prisma.glossaryGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { terms: true } })).map((g) => g.terms)),

  /** The lookup the searches use. */
  load: cache(async (): Promise<Glossary> => buildGlossary(await glossary.groups())),

  async text(): Promise<string> {
    return (await glossary.groups()).map((g) => g.join(", ")).join("\n");
  },

  async save(actor: Actor, text: string): Promise<{ count: number }> {
    assertCan(actor, "settings.manage");
    const { groups, badLines } = parseGlossaryText(text);
    if (badLines.length) throw new SettingsError(`A line needs at least two different words, separated by commas (line ${badLines.join(", ")}).`, "text");
    await prisma.$transaction(async (tx) => {
      await tx.glossaryGroup.deleteMany({});
      await tx.glossaryGroup.createMany({ data: groups.map((terms, i) => ({ terms, sortOrder: i + 1 })) });
      await logActivity(actor, { entityType: "settings", entityId: "glossary", action: "glossary_saved", summary: `Saved the search words (${groups.length} ${groups.length === 1 ? "group" : "groups"})` }, tx);
    });
    return { count: groups.length };
  },
};
