import { describe, expect, it, vi } from "vitest";
import { buildRequest, configuredExtractor, foundNumber, geminiExtractor, geminiUnreachable, interactionText, readExtraction, toSpecRow, type ExtractModel } from "../lookup-extract";
import { datasheetLinks, embeddedText, fetchPublic, htmlToText, isPrivateAddress, LookupError } from "../lookup-source";

const defs: ExtractModel["defs"] = [
  { key: "lumen", label: "Lumen", type: "number", options: [] },
  { key: "lens", label: "Lens mount", type: "select", options: ["Fixed", "Interchangeable"] },
  { key: "ip", label: "IP rated", type: "checkbox", options: [] },
  { key: "bought", label: "Bought", type: "date", options: [] },
];
const model: ExtractModel = { manufacturer: "Panasonic", name: "PT-RZ990", variant: null, category: "Video › Projectors", defs };

describe("reading pages", () => {
  it("keeps the text, table cells apart, and drops scripts and styles", () => {
    const html = `<html><head><title>PT-RZ990 &amp; more</title><style>.x{}</style><script>var a="<td>no</td>"</script></head>
      <body><h1>PT-RZ990</h1><p>Brightness:&nbsp;9,400&nbsp;lm</p><table><tr><th>Weight</th><td>21.7 kg</td></tr><tr><th>Power</th><td>620 W</td></tr></table></body></html>`;
    const { title, text } = htmlToText(html);
    expect(title).toBe("PT-RZ990 & more");
    expect(text).toContain("Brightness: 9,400 lm");
    expect(text).toContain("Weight | 21.7 kg");
    expect(text).toContain("Power | 620 W");
    expect(text).not.toContain("var a");
    expect(text).not.toContain(".x{}");
  });

  it("reads the specs a script-built page keeps in its embedded data", () => {
    const data = { props: { pageProps: { product: { id: "a1b2c3d4e5f6a7b8c9d0", image: "/img/pointe.png", updated: "2025-10-24T15:44:19.679806+00:00", spec: [{ type: "paragraph", children: [{ text: "Weight: 15 kg (33 lbs)\r" }] }, { text: "Depth: 250 mm" }], label: "Downloads" } } } };
    const html = `<html><body><div id="root"></div><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>
      <script type="application/ld+json">{"@type":"Product","name":"Pointe","brand":"Robe"}</script><script>var x = "Weight: 99 kg"</script></body></html>`;
    expect(embeddedText(html).split("\n")).toEqual(["Weight: 15 kg (33 lbs)", "Depth: 250 mm"]);
    expect(htmlToText(html).text).not.toContain("Weight");
  });

  it("finds the datasheet on a page, then manuals, and never legal papers or unnamed PDFs", () => {
    const html = `<a href="/files/manual.pdf">Operating manual</a><a href="https://cdn.example.com/rz990_spec.pdf?v=2">Spec sheet</a><a href="/about">About</a><a href="brochure.pdf">Brochure</a>
      <a href="/res/doc/legal/Code_of_Conduct.pdf">Code of Conduct</a><a href="/terms.pdf">General Terms and Conditions</a><a href="#downloads-58">Manuals</a>`;
    expect(datasheetLinks(html, "https://pro.example.com/products/rz990/")).toEqual([
      { label: "Spec sheet", url: "https://cdn.example.com/rz990_spec.pdf?v=2" },
      { label: "Operating manual", url: "https://pro.example.com/files/manual.pdf" },
    ]);
  });

  it("follows a datasheet link that does not end in .pdf (Robe)", () => {
    const html = `<a href="https://www.robe.cz/api/robe/pdfs/en/product/2">Data Sheet</a><a href="https://www.robe.cz/res/doc/legal/Robe_Code_of_Conduct.pdf">Code of Conduct</a>`;
    expect(datasheetLinks(html, "https://www.robe.cz/pointe")).toEqual([{ label: "Data Sheet", url: "https://www.robe.cz/api/robe/pdfs/en/product/2" }]);
  });
});

describe("only public addresses", () => {
  it("knows private, loopback and link-local addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:192.168.0.1"]) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("refuses a private address, and a redirect to one", async () => {
    await expect(fetchPublic("http://192.168.1.20/admin")).rejects.toThrow(/private network/);
    await expect(fetchPublic("ftp://example.com/x.pdf")).rejects.toThrow(/http and https/);
    const redirecting = (async () => new Response(null, { status: 302, headers: { location: "http://10.0.0.5/secret" } })) as unknown as typeof fetch;
    await expect(fetchPublic("http://93.184.216.34/datasheet", redirecting)).rejects.toThrow(/private network/);
  });
});

describe("the extraction request and answer", () => {
  it("asks for the standard fields and the category's extra fields (not dates), with the documents", () => {
    const { instructions, input, schema } = buildRequest({ model, documents: [{ url: "https://x.example/rz990", title: "PT-RZ990", kind: "html", text: "Weight 21.7 kg" }] });
    expect(instructions).toMatch(/Never guess/);
    expect(input).toContain("Product: Panasonic PT-RZ990");
    expect(input).toContain("- x:lens: Lens mount (one of: Fixed, Interchangeable)");
    expect(input).toContain("Weight 21.7 kg");
    const fields = (schema as { properties: { values: { items: { properties: { field: { enum: string[] } } } } } }).properties.values.items.properties.field.enum;
    expect(fields).toEqual(["weightKg", "widthCm", "heightCm", "depthCm", "powerDrawW", "x:lumen", "x:lens", "x:ip"]);
  });

  it("reads the JSON answer, also inside a code fence, and refuses anything else", () => {
    const x = readExtraction('```json\n{"matches_model":true,"product":"PT-RZ990","values":[{"field":"weightKg","value":"21.7","evidence":"Weight 21.7 kg"}],"description":"","notes":""}\n```');
    expect(x).toMatchObject({ matchesModel: true, product: "PT-RZ990", findings: [{ field: "weightKg", value: "21.7" }] });
    expect(() => readExtraction("Sorry, I could not find it.")).toThrow(LookupError);
  });

  it("reads found numbers with a dot as the decimal point, commas as thousands", () => {
    expect([foundNumber("9,400 lm"), foundNumber("1,234.5"), foundNumber("21.7 kg"), foundNumber("21,7"), foundNumber("620W"), foundNumber("n/a")]).toEqual([9400, 1234.5, 21.7, 21.7, 620, null]);
  });

  it("maps findings to a spec row and drops values that do not fit their field", () => {
    const { row, evidence } = toSpecRow(
      "m1",
      {
        matchesModel: true,
        product: "PT-RZ990",
        description: "A 9,400 lumen laser projector.",
        notes: "",
        findings: [
          { field: "weightKg", value: "21.7 kg", evidence: "Weight 21.7 kg" },
          { field: "powerDrawW", value: "620.4", evidence: "620 W" },
          { field: "widthCm", value: "unknown", evidence: "" },
          { field: "x:lumen", value: "9,400", evidence: "9,400 lm" },
          { field: "x:lens", value: "interchangeable", evidence: "Optional lenses" },
          { field: "x:ip", value: "maybe", evidence: "" },
          { field: "x:bought", value: "2024-01-01", evidence: "" },
          { field: "x:nope", value: "1", evidence: "" },
        ],
      },
      defs,
    );
    expect(row.numbers).toEqual({ weightKg: 21.7, powerDrawW: 620 });
    expect(row.extra).toEqual({ Lumen: "9400", "Lens mount": "Interchangeable" });
    expect(row.description).toBe("A 9,400 lumen laser projector.");
    expect(evidence).toMatchObject({ weightKg: "Weight 21.7 kg", lumen: "9,400 lm" });
  });
});

describe("Gemini", () => {
  const answer = { matches_model: true, product: "PT-RZ990", values: [{ field: "weightKg", value: "21.7", evidence: "21.7 kg" }], description: "", notes: "" };

  it("takes the last model output of an Interactions response", () => {
    const body = { steps: [{ type: "thought", summary: [] }, { type: "model_output", content: [{ type: "text", text: '{"a":' }, { type: "text", text: "1}" }] }] };
    expect(interactionText(body)).toBe('{"a":1}');
    expect(interactionText({ output_text: "x" })).toBe("x");
  });

  it("sends a stateless JSON request without search, and reads the answer", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Response.json({ steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(answer) }] }] });
    }) as unknown as typeof fetch;
    const x = await geminiExtractor({ apiKey: "test-key", fetchImpl: fake }).extract({ model, documents: [] });
    expect(x.findings).toEqual([{ field: "weightKg", value: "21.7", evidence: "21.7 kg" }]);
    expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent).toMatchObject({ model: "gemini-3.8-flash", store: false, generation_config: { thinking_level: "low" }, response_format: { type: "text", mime_type: "application/json" } });
    expect(sent.tools).toBeUndefined();
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });

  it("explains a used-up free tier and a refused key", async () => {
    const status = (code: number, body: unknown = {}) => (async () => Response.json(body, { status: code })) as unknown as typeof fetch;
    await expect(geminiExtractor({ apiKey: "k", fetchImpl: status(429) }).extract({ model, documents: [] })).rejects.toThrow(/free limit is used up/);
    await expect(geminiExtractor({ apiKey: "k", fetchImpl: status(400, [{ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }]) }).extract({ model, documents: [] })).rejects.toThrow("Gemini refused the request: API key not valid. Please pass a valid API key. Check GEMINI_API_KEY and SPEC_LOOKUP_MODEL.");
  });

  it("says whether Gemini was slow or could not be reached at all", () => {
    expect(geminiUnreachable(new DOMException("The operation timed out.", "TimeoutError"))).toMatch(/did not answer within 75 seconds/);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const offline = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND generativelanguage.googleapis.com" } });
    expect(geminiUnreachable(offline)).toBe("The server could not reach Gemini (ENOTFOUND). Check that it can reach generativelanguage.googleapis.com.");
    quiet.mockRestore();
  });

  const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

  it("is only set up with a key", () => {
    expect(configuredExtractor(env({}))).toBeNull();
    expect(configuredExtractor(env({ GEMINI_API_KEY: "k" }))?.name).toBe("Gemini (gemini-3.8-flash)");
    expect(configuredExtractor(env({ GEMINI_API_KEY: "k", SPEC_LOOKUP_MODEL: "gemini-3.5-flash-lite" }))?.name).toBe("Gemini (gemini-3.5-flash-lite)");
    expect(configuredExtractor(env({ GEMINI_API_KEY: "k", SPEC_LOOKUP_PROVIDER: "none" }))).toBeNull();
  });
});
