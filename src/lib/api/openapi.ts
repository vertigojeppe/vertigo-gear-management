import { z } from "zod";
import { appConfig } from "../../../config/app.config";
import { categoryInput, itemBatchInput, itemFilters, itemInput, locationInput, modelFilters, modelInput, statusChangeInput, moveInput } from "@/modules/inventory";
import { allocationInput, availabilityQuery, projectFilters, projectInput } from "@/modules/projects";
import { rentalFilters, rentalInput } from "@/modules/rentals";

/**
 * Declarative description of the REST API, rendered as OpenAPI at
 * /api/openapi.json and browsable at /api/docs. Keep in sync with the
 * route handlers under src/app/api/v1 (the handlers reuse the same zod
 * schemas, so request shapes cannot drift).
 */
type Op = {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  tag: string;
  summary: string;
  description?: string;
  query?: z.ZodObject<z.ZodRawShape>;
  body?: z.ZodTypeAny;
  params?: string[];
  responses?: Record<number, string>;
};

const idParam = ["id"];

export const operations: Op[] = [
  { method: "get", path: "/categories", tag: "Categories", summary: "List categories (flat; use parentId to rebuild the tree)" },
  { method: "post", path: "/categories", tag: "Categories", summary: "Create a category", body: categoryInput },
  { method: "get", path: "/categories/{id}", tag: "Categories", summary: "Get a category", params: idParam },
  { method: "patch", path: "/categories/{id}", tag: "Categories", summary: "Update a category", params: idParam, body: categoryInput.partial() },
  { method: "delete", path: "/categories/{id}", tag: "Categories", summary: "Delete an empty category", params: idParam },

  { method: "get", path: "/locations", tag: "Locations", summary: "List locations" },
  { method: "post", path: "/locations", tag: "Locations", summary: "Create a location", body: locationInput },
  { method: "get", path: "/locations/{id}", tag: "Locations", summary: "Get a location", params: idParam },
  { method: "patch", path: "/locations/{id}", tag: "Locations", summary: "Update a location", params: idParam, body: locationInput.partial() },
  { method: "delete", path: "/locations/{id}", tag: "Locations", summary: "Delete an empty location", params: idParam },

  { method: "get", path: "/models", tag: "Models", summary: "List models with owned / in-house counts", query: modelFilters },
  { method: "post", path: "/models", tag: "Models", summary: "Create a model", body: modelInput.extend({ customFields: z.record(z.string(), z.unknown()).optional() }) },
  { method: "get", path: "/models/{id}", tag: "Models", summary: "Get a model with its items", params: idParam },
  { method: "patch", path: "/models/{id}", tag: "Models", summary: "Update a model", params: idParam, body: modelInput.partial().extend({ customFields: z.record(z.string(), z.unknown()).optional() }) },
  { method: "delete", path: "/models/{id}", tag: "Models", summary: "Delete a model without items", params: idParam },

  { method: "get", path: "/items", tag: "Items", summary: "List items", query: itemFilters },
  { method: "post", path: "/items", tag: "Items", summary: "Create items (count > 1 creates several serialized units)", body: itemBatchInput.extend({ customFields: z.record(z.string(), z.unknown()).optional() }) },
  { method: "get", path: "/items/{id}", tag: "Items", summary: "Get an item with status history", params: idParam },
  { method: "patch", path: "/items/{id}", tag: "Items", summary: "Update an item", params: idParam, body: itemInput.partial().extend({ customFields: z.record(z.string(), z.unknown()).optional() }) },
  { method: "delete", path: "/items/{id}", tag: "Items", summary: "Delete an item (admin)", params: idParam },
  { method: "post", path: "/items/{id}/status", tag: "Items", summary: "Change status (cascades to kit contents)", params: idParam, body: statusChangeInput },
  { method: "post", path: "/items/{id}/move", tag: "Items", summary: "Move to a location (cascades to kit contents)", params: idParam, body: moveInput },
  { method: "get", path: "/items/by-tag/{tag}", tag: "Items", summary: "Look up an item by asset tag (e.g. VG-0042)", params: ["tag"] },

  { method: "get", path: "/models/{id}/availability", tag: "Availability", summary: "Owned / unavailable / allocated / available for a model in a date range", params: idParam, query: availabilityQuery },

  { method: "get", path: "/projects", tag: "Projects", summary: "List projects", query: projectFilters },
  { method: "post", path: "/projects", tag: "Projects", summary: "Create a project", body: projectInput.extend({ customFields: z.record(z.string(), z.unknown()).optional() }) },
  { method: "get", path: "/projects/{id}", tag: "Projects", summary: "Project with client, crew, contacts and reservations (incl. availability)", params: idParam },
  { method: "post", path: "/projects/{id}/reservations", tag: "Projects", summary: "Reserve a model for the project; 409 with conflict details unless force", params: idParam, body: allocationInput, responses: { 409: "Not enough available; body has { available, requested, shortfall, conflicts }" } },

  { method: "get", path: "/rentals", tag: "Rentals", summary: "List rentals", query: rentalFilters },
  { method: "post", path: "/rentals", tag: "Rentals", summary: "Create a rental", body: rentalInput },
  { method: "get", path: "/rentals/{id}", tag: "Rentals", summary: "Rental with lines and totals", params: idParam },
];

function schemaJson(schema: z.ZodTypeAny) {
  return z.toJSONSchema(schema, { target: "openapi-3.0", unrepresentable: "any", io: "input" }) as Record<string, unknown>;
}

export function buildOpenApiDocument(baseUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of operations) {
    const entry: Record<string, unknown> = {
      tags: [op.tag],
      summary: op.summary,
      description: op.description,
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        ...(op.params ?? []).map((p) => ({ name: p, in: "path", required: true, schema: { type: "string" } })),
        ...(op.query
          ? Object.entries(op.query.shape).map(([name, s]) => ({
              name,
              in: "query",
              required: false,
              schema: schemaJson(s as z.ZodTypeAny),
            }))
          : []),
      ],
      responses: {
        200: { description: "OK" },
        400: { description: "Domain error ({ error, field? })" },
        401: { description: "Missing or invalid token" },
        403: { description: "Permission denied" },
        404: { description: "Not found" },
        422: { description: "Validation failed ({ error, details[] })" },
        ...Object.fromEntries(Object.entries(op.responses ?? {}).map(([k, v]) => [k, { description: v }])),
      },
    };
    if (op.body) {
      entry.requestBody = { required: true, content: { "application/json": { schema: schemaJson(op.body) } } };
    }
    paths[op.path] = { ...(paths[op.path] ?? {}), [op.method]: entry };
  }
  return {
    openapi: "3.0.3",
    info: {
      title: `${appConfig.name} API`,
      version: "1",
      description:
        "Internal REST API used by the UI and available to other tools (TouchDesigner, Companion, spreadsheets). Authenticate with a per-user API token from Settings › Your account as `Authorization: Bearer <token>`.",
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
        cookieAuth: { type: "apiKey", in: "cookie", name: "authjs.session-token" },
      },
    },
    paths,
  };
}
