import { z } from "zod";
import { ApiError, handler, json, queryObject, readJson } from "@/lib/api/respond";
import { validateCustomFields } from "@/lib/custom-fields";
import { listProjects, projectFilters, projectInput, projects } from "@/modules/projects";
import { customFieldDefinitions } from "@/modules/settings";

export const GET = handler("projects.read", async (req) => json(await listProjects(projectFilters.parse(queryObject(req)))));

const createBody = projectInput.extend({ customFields: z.record(z.string(), z.unknown()).optional() });

export const POST = handler("projects.write", async (req, actor) => {
  const { customFields, ...input } = await readJson(req, createBody);
  const defs = await customFieldDefinitions.forEntity("project");
  const cf = validateCustomFields(defs, customFields ?? {});
  if (!cf.ok) throw new ApiError(422, "Custom field validation failed", cf.errors);
  return json({ data: await projects.create(actor, input, cf.values) }, { status: 201 });
});
