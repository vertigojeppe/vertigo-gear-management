import type { CustomFieldDef } from "@/lib/custom-fields";
import { LookupError, type SourceDocument } from "./lookup-source";
import { SPEC_NUMBERS, type SpecNumberField, type SpecRow } from "./specs";

/**
 * Reading specs out of documents. The request and the answer are provider
 * neutral (plain text in, `Extraction` out); `geminiExtractor` is one
 * implementation, and another provider only needs its own `extract`.
 */
export type ExtractModel = { manufacturer: string; name: string; variant: string | null; category: string; defs: Pick<CustomFieldDef, "key" | "label" | "type" | "options">[] };
export type ExtractRequest = { model: ExtractModel; documents: SourceDocument[] };
/** `field`: a standard field (weightKg …) or `x:<extra field key>`. */
export type Finding = { field: string; value: string; evidence: string };
export type Extraction = { matchesModel: boolean; product: string; findings: Finding[]; description: string; notes: string };
export type SpecExtractor = { name: string; extract(req: ExtractRequest): Promise<Extraction> };

const STANDARD: Record<SpecNumberField, string> = {
  weightKg: "Weight in kg (the unit itself, without flight case or packaging)",
  widthCm: "Width in cm (side to side)",
  heightCm: "Height in cm",
  depthCm: "Depth or length in cm (front to back)",
  powerDrawW: "Power draw in watts: maximum or rated power consumption of the whole unit, a whole number",
};

/** Field list, instructions and JSON schema for one model; the same for every provider. */
export function buildRequest(req: ExtractRequest): { instructions: string; input: string; schema: Record<string, unknown> } {
  const extra = req.model.defs.filter((d) => d.type !== "date");
  const fields = [
    ...SPEC_NUMBERS.map((s) => ({ key: s.field, about: STANDARD[s.field] })),
    ...extra.map((d) => ({
      key: `x:${d.key}`,
      about: `${d.label}${d.type === "number" ? " (a number, without the unit)" : d.type === "checkbox" ? ' ("yes" or "no")' : d.type === "select" ? ` (one of: ${d.options.join(", ")})` : d.type === "url" ? " (a full https link)" : ""}`,
    })),
  ];
  const instructions = [
    "You read manufacturer product pages and datasheets and pull out specifications for one product in an equipment inventory.",
    "Use only what the documents state. Never guess, estimate or fill in from general knowledge; leave a field out when the documents do not give it.",
    "If the documents cover several models or versions, use only the values for the requested one; skip a field when you cannot tell which value belongs to it.",
    "Convert units: weight to kg, sizes to cm (mm ÷ 10, inches × 2.54), power to W. Write numbers with a dot as the decimal point and no thousands separators.",
    "For every value, quote the short piece of the document it comes from as evidence, exactly as written there.",
    'description: the key specifications the fields above do not cover, one per line as "Label: value", the ones a technician needs most first (power source or battery, output, light source or drivers, connections and control, protection rating …). Values as the documents give them, combined on one line where they belong together, e.g. "Battery: swappable 99.84 Wh LiFePO4, 40 h at mid volume / 10 h at full", "Connectivity: Bluetooth 5.0, 3.5 mm input". 4 to 10 lines, in English, no marketing language, no sentence about what the product is; empty when the documents give none.',
    "matches_model: false when the documents are about a different product than the one requested.",
  ].join("\n");
  const model = [req.model.manufacturer, req.model.name, req.model.variant].filter(Boolean).join(" ");
  const input = [
    `Product: ${model}`,
    `Category in our inventory: ${req.model.category}`,
    "",
    "Fields to fill (key: meaning):",
    ...fields.map((f) => `- ${f.key}: ${f.about}`),
    "",
    ...req.documents.flatMap((d, i) => [`=== Document ${i + 1}: ${d.title} (${d.kind === "pdf" ? "PDF" : "web page"}, ${d.url}) ===`, d.text, ""]),
  ].join("\n");
  const schema = {
    type: "object",
    properties: {
      matches_model: { type: "boolean", description: "The documents describe the requested product." },
      product: { type: "string", description: "The product name as the documents give it." },
      values: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string", enum: fields.map((f) => f.key) },
            value: { type: "string" },
            evidence: { type: "string", description: "The words in the document the value comes from." },
          },
          required: ["field", "value", "evidence"],
        },
      },
      description: { type: "string", description: 'Key specifications not covered by the fields, one "Label: value" per line.' },
      notes: { type: "string", description: "Anything the reviewer should know, e.g. which variant the values are for; empty when nothing." },
    },
    required: ["matches_model", "product", "values", "description", "notes"],
  };
  return { instructions, input, schema };
}

/** The answer as JSON, whatever the provider wrapped around it. */
export function readExtraction(text: string): Extraction {
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1));
  } catch {
    throw new LookupError("The answer could not be read. Try again.");
  }
  const values = Array.isArray(raw.values) ? raw.values : [];
  return {
    matchesModel: raw.matches_model !== false,
    product: String(raw.product ?? ""),
    findings: values
      .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
      .map((v) => ({ field: String(v.field ?? ""), value: String(v.value ?? "").trim(), evidence: String(v.evidence ?? "").trim() }))
      .filter((f) => f.field && f.value),
    description: String(raw.description ?? "").trim(),
    notes: String(raw.notes ?? "").trim(),
  };
}

/**
 * A number from the extractor, which is asked for a dot as the decimal
 * point: "9,400" and "1,234.5" have thousands separators, a lone "21,7" is
 * still read as a decimal comma. Units and spaces around it are ignored.
 */
export function foundNumber(raw: string): number | null {
  const s = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;
  let n: string;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) n = s.replace(/,/g, "");
  else if (s.includes(",") && !s.includes(".")) n = s.replace(",", ".");
  else n = s.replace(/,/g, "");
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

/**
 * The extraction as a spec row for the sheet planner (`planSpecs`), so a
 * lookup is reviewed and applied exactly like a spec sheet. Values that do
 * not fit the field (not a number, not one of a select's options, not a
 * link) are dropped; `evidence` keeps the quote per row field.
 */
export function toSpecRow(modelId: string, x: Extraction, defs: ExtractModel["defs"]): { row: SpecRow; evidence: Record<string, string> } {
  const row: SpecRow = { line: 1, id: modelId, numbers: {}, extra: {}, links: [] };
  const evidence: Record<string, string> = {};
  for (const f of x.findings) {
    const std = SPEC_NUMBERS.find((s) => s.field === f.field);
    if (std) {
      const n = foundNumber(f.value);
      if (n === null || n <= 0) continue;
      row.numbers[std.field] = std.integer ? Math.round(n) : Math.round(n * 1000) / 1000;
      evidence[std.field] = f.evidence;
      continue;
    }
    const def = f.field.startsWith("x:") ? defs.find((d) => d.key === f.field.slice(2)) : undefined;
    if (!def || def.type === "date") continue;
    let value = f.value;
    if (def.type === "number") {
      const n = foundNumber(value);
      if (n === null) continue;
      value = String(n);
    } else if (def.type === "select") {
      const option = def.options.find((o) => o.toLowerCase() === value.toLowerCase());
      if (!option) continue;
      value = option;
    } else if (def.type === "checkbox") {
      if (!/^(yes|no|true|false|ja|nej)$/i.test(value)) continue;
      value = /^(yes|true|ja)$/i.test(value) ? "yes" : "no";
    } else if (def.type === "url" && !/^https?:\/\/\S+$/i.test(value)) continue;
    row.extra[def.label] = value;
    evidence[def.key] = f.evidence;
  }
  if (x.description) {
    row.description = x.description;
    evidence.description = "";
  }
  return { row, evidence };
}

/* Gemini ------------------------------------------------------------------ */

/** Google's "overloaded / try later" answers, worth retrying. */
const BUSY = new Set([500, 502, 503, 504]);

/** The final answer text of an Interactions API response (the last model_output step). */
export function interactionText(body: unknown): string {
  const b = body as { output_text?: unknown; steps?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  if (typeof b?.output_text === "string") return b.output_text;
  const outputs = (b?.steps ?? []).filter((s) => s.type === "model_output");
  const last = outputs[outputs.length - 1];
  return (last?.content ?? []).filter((c) => c.type === "text" && typeof c.text === "string").map((c) => c.text).join("");
}

/**
 * Google Gemini through the Interactions API, with a JSON schema for the
 * answer and no tools (no Google Search: its terms forbid storing results).
 * Free tier: the request may be used by Google to improve its products;
 * it only holds public product documents.
 */
export function geminiExtractor(opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch; retryDelaysMs?: number[] }): SpecExtractor {
  // 3.5 Flash read real datasheets better than 3.8 Flash at Vertigo (October 2026).
  const model = opts.model || "gemini-3.5-flash";
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    name: `Gemini (${model})`,
    async extract(req) {
      const { instructions, input, schema } = buildRequest(req);
      // Under Cloudflare's 100-second limit for the whole request, retries included.
      const signal = AbortSignal.timeout(75_000);
      let res!: Response;
      // Google answers 503 when the model is overloaded for a moment; it usually passes within seconds.
      for (const wait of [0, ...(opts.retryDelaysMs ?? [2_000, 5_000])]) {
        if (wait) await new Promise((r) => setTimeout(r, wait));
        try {
          res = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/interactions", {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": opts.apiKey },
            // Low thinking: copying values out of a document needs little, and the
            // default (medium) can take over a minute on a long datasheet.
            body: JSON.stringify({ model, system_instruction: instructions, input, store: false, generation_config: { thinking_level: "low" }, response_format: { type: "text", mime_type: "application/json", schema } }),
            signal,
          });
        } catch (e) {
          throw new LookupError(geminiUnreachable(e));
        }
        if (!BUSY.has(res.status)) break;
      }
      if (BUSY.has(res.status)) throw new LookupError(`Gemini is busy right now (${res.status}). Try again in a minute.`);
      if (res.status === 429) throw new LookupError("Gemini's free limit is used up for now. Try again later.");
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        // Google wraps errors in a list: [{ "error": { "message": "API key not valid…" } }].
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | { error?: { message?: string } }[] | null;
        const detail = (Array.isArray(body) ? body[0] : body)?.error?.message;
        throw new LookupError(`Gemini refused the request${detail ? `: ${detail.slice(0, 200).replace(/\.+$/, "")}` : ""}. Check GEMINI_API_KEY and SPEC_LOOKUP_MODEL.`);
      }
      if (!res.ok) throw new LookupError(`Gemini answered ${res.status}. Try again.`);
      return readExtraction(interactionText(await res.json()));
    },
  };
}

/**
 * Why the request to Gemini failed before an answer: its own timeout, or the
 * server could not reach Google at all (DNS, firewall, proxy), with Node's
 * reason (`fetch failed` hides it in `cause`). Logged as well for the server log.
 */
export function geminiUnreachable(e: unknown): string {
  const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return "Gemini did not answer within 75 seconds. Try again, or paste the datasheet PDF instead of the product page.";
  const reason = err?.cause?.code || err?.cause?.message || err?.message || String(e);
  console.error("[spec lookup] Gemini unreachable:", e);
  return `The server could not reach Gemini (${reason}). Check that it can reach generativelanguage.googleapis.com.`;
}

/** The extractor the server is set up for (env), or null when spec lookup is off. */
export function configuredExtractor(env: NodeJS.ProcessEnv = process.env): SpecExtractor | null {
  const provider = (env.SPEC_LOOKUP_PROVIDER || (env.GEMINI_API_KEY ? "gemini" : "")).toLowerCase();
  if (provider === "gemini" && env.GEMINI_API_KEY) return geminiExtractor({ apiKey: env.GEMINI_API_KEY, model: env.SPEC_LOOKUP_MODEL });
  return null;
}
