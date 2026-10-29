import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Where a spec lookup reads from. A source turns "this model" into the
 * documents to read; today that is the product page or datasheet the user
 * pastes (`linkSource`), later it can be a search that finds those links
 * itself. Sources hand plain text to the extractor, so any provider can
 * read them.
 */
export type SourceDocument = { url: string; title: string; kind: "html" | "pdf"; text: string };
export type GatheredSources = {
  documents: SourceDocument[];
  /** Product page / datasheet links worth keeping on the model (the page itself, PDFs it links to). */
  links: { label: string; url: string }[];
  /** Pictures that may show the product, for the reviewer to pick one (`productImages`). */
  images?: string[];
};
export type SourceRequest = { manufacturer: string; name: string; variant: string | null; url?: string };
export type SpecSource = { kind: string; gather(req: SourceRequest): Promise<GatheredSources> };

export class LookupError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "LookupError";
  }
}

/** Characters of document text handed to the extractor (a datasheet is far less). */
export const MAX_TEXT = 60_000;
const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

/* Pure helpers ------------------------------------------------------------ */

/** Addresses the server must never be sent to: loopback, private, link-local, CGNAT, multicast. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°", times: "×", sup2: "²", sup3: "³", plusmn: "±", micro: "µ", ndash: "–", mdash: "—", aelig: "æ", oslash: "ø", aring: "å", AElig: "Æ", Oslash: "Ø", Aring: "Å" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d?);/gi, (all, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? all;
  });
}

/**
 * Text inside a page's embedded data: `application/json` and `ld+json`
 * scripts (Next.js `__NEXT_DATA__`, Nuxt, schema.org Product). Sites built
 * by scripts keep their specs there (Robe: "Weight: 15 kg (33 lbs)"), not in
 * the HTML. Keeps readable strings in order; drops ids, links, file names
 * and timestamps.
 */
export function embeddedText(html: string): string {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (v: unknown, depth: number) => {
    if (depth > 60) return;
    if (typeof v === "string") {
      const s = v.replace(/\s+/g, " ").trim();
      if (s.length < 3 || s.length > 600 || seen.has(s)) return;
      if (/^(https?:|\/|#|data:|mailto:)|\.(png|jpe?g|gif|svg|webp|js|css|woff2?)$/i.test(s)) return;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) || /^[0-9a-f-]{16,}$/i.test(s)) return;
      if (!/\s/.test(s) && !/\d/.test(s)) return;
      seen.add(s);
      out.push(s);
    } else if (Array.isArray(v)) for (const x of v) walk(x, depth + 1);
    else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x, depth + 1);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]), 0);
    } catch {
      /* not JSON after all */
    }
  }
  return out.join("\n");
}

/** Readable text from a page: scripts and styles dropped, table cells kept apart, one block per line. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim());
  const text = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(td|th)>/gi, " | ")
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table|dt|dd|ul|ol|header|footer)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t\f\v ]+/g, " ").replace(/^[ |]+|[ |]+$/g, "").trim())
    .filter(Boolean)
    .join("\n");
  return { title, text };
}

/**
 * Links on a page that look like the product's datasheet or manual, best
 * first: a datasheet / spec sheet / technical data link (PDF or not: Robe's
 * is /api/robe/pdfs/en/product/2), then manuals that are PDFs. Legal
 * papers and PDFs that say nothing about what they are are left out.
 */
export function datasheetLinks(html: string, base: string): { label: string; url: string }[] {
  const found = new Map<string, { label: string; url: string; score: number }>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(decodeEntities(m[1]), base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || url.hash && url.pathname === new URL(base).pathname) continue;
    const label = decodeEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || decodeURIComponent(url.pathname.split("/").pop() ?? "PDF");
    const hay = `${label} ${decodeURIComponent(url.pathname)}`.toLowerCase();
    if (/legal|terms|condition|policy|privacy|conduct|whistle|cookie|warranty|gdpr|imprint/.test(hay)) continue;
    const pdf = /\.pdf($|\?)/i.test(url.pathname + url.search) || /\/pdfs?\//i.test(url.pathname);
    const score = /data ?sheet|spec ?sheet|specifications?\b|technical (data|spec)/.test(hay) ? 2 : pdf && /manual|user ?guide|quick ?guide/.test(hay) ? 1 : 0;
    if (score === 0) continue;
    const key = url.toString();
    if (!found.has(key) || found.get(key)!.score < score) found.set(key, { label: label.slice(0, 80), url: key, score });
  }
  return [...found.values()].sort((a, b) => b.score - a.score).map(({ label, url }) => ({ label, url }));
}

/**
 * Pictures on a product page that could be the product, for the reviewer to
 * pick from: the schema.org Product image, og:image / twitter:image, then the
 * page's own images. No single marker is reliable (Robe's og:image is a site
 * banner and its Product image is empty), so a person chooses. Icons, logos
 * (SVG) and thumbnails under 120 px are left out.
 */
export function productImages(html: string, base: string, max = 8): string[] {
  const found: string[] = [];
  const add = (raw: unknown) => {
    if (typeof raw !== "string" || !raw.trim()) return;
    try {
      const url = new URL(decodeEntities(raw.trim()), base);
      if (!/^https?:$/.test(url.protocol) || /\.svg$|\.ico$/i.test(url.pathname)) return;
      if (Number(url.searchParams.get("width") ?? url.searchParams.get("w") ?? 999) < 120 || found.includes(url.toString())) return;
      found.push(url.toString());
    } catch {
      /* not a link */
    }
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      for (const d of [data, ...(Array.isArray(data) ? data : []), ...(data?.["@graph"] ?? [])]) {
        if (d?.["@type"] !== "Product") continue;
        for (const img of [d.image].flat()) add(typeof img === "object" ? img?.url : img);
      }
    } catch {
      /* not JSON after all */
    }
  }
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (/(property|name)\s*=\s*["'](og:image|twitter:image)["']/i.test(m[0])) add(m[0].match(/content\s*=\s*["']([^"']+)["']/i)?.[1]);
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (n: string) => tag.match(new RegExp(`\\s${n}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
    if (Number(attr("width") ?? 999) < 120 || Number(attr("height") ?? 999) < 120) continue;
    add(attr("src") ?? attr("data-src"));
  }
  return found.slice(0, max);
}

/* Fetching ---------------------------------------------------------------- */

async function assertPublic(url: URL) {
  if (!/^https?:$/.test(url.protocol)) throw new LookupError("Only http and https links can be read.", "url");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new LookupError(`Could not find ${host}.`, "url");
  if (addresses.some(isPrivateAddress)) throw new LookupError("That address is on a private network; only public pages can be read.", "url");
}

/**
 * GET a public page or PDF: every redirect hop is checked against private
 * addresses (so a link cannot make the server read the office network),
 * size and time are capped.
 */
export async function fetchPublic(raw: string, fetchImpl: typeof fetch = fetch): Promise<{ url: string; contentType: string; bytes: Buffer }> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new LookupError("That is not a web address.", "url");
  }
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "Mozilla/5.0 (compatible; VertigoGear spec lookup)", accept: "text/html,application/pdf;q=0.9,*/*;q=0.5" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new LookupError(`The page answered ${res.status}.`, "url");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new LookupError("The file is too large to read (over 15 MB).", "url");
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new LookupError("The file is too large to read (over 15 MB).", "url");
    return { url: url.toString(), contentType: (res.headers.get("content-type") ?? "").toLowerCase(), bytes };
  }
  throw new LookupError("Too many redirects.", "url");
}

/** Text of a PDF (pdf.js, no worker, no fonts). */
export async function pdfToText(bytes: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false });
  const doc = await task.promise;
  let out = "";
  for (let p = 1; p <= Math.min(doc.numPages, 40) && out.length < MAX_TEXT; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    out += content.items.map((i) => ("str" in i ? i.str + (i.hasEOL ? "\n" : " ") : "")).join("") + "\n";
  }
  await task.destroy();
  return out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function readDocument(raw: string, fetchImpl: typeof fetch): Promise<{ doc: SourceDocument; html?: string }> {
  const { url, contentType, bytes } = await fetchPublic(raw, fetchImpl);
  const isPdf = contentType.includes("pdf") || bytes.subarray(0, 5).toString() === "%PDF-";
  if (isPdf) {
    let text: string;
    try {
      text = await pdfToText(bytes);
    } catch {
      throw new LookupError("Could not read that PDF.", "url");
    }
    return { doc: { url, title: decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "PDF"), kind: "pdf", text: text.slice(0, MAX_TEXT) } };
  }
  if (!contentType.includes("html") && !contentType.includes("text")) throw new LookupError("That link is neither a web page nor a PDF.", "url");
  const html = bytes.toString("utf8");
  const { title, text } = htmlToText(html);
  // Visible text first, then what the page keeps in its embedded data.
  const data = embeddedText(html);
  const all = data ? `${text}\n\n--- Page data ---\n${data}` : text;
  return { doc: { url, title: title || new URL(url).hostname, kind: "html", text: all.slice(0, MAX_TEXT) }, html };
}

/**
 * The link the user pasted: a product page (plus the first datasheet PDF it
 * links to, since specs often live there) or a PDF.
 */
export function linkSource(fetchImpl: typeof fetch = fetch): SpecSource {
  return {
    kind: "link",
    async gather(req) {
      if (!req.url) throw new LookupError("Paste the product page or datasheet link.", "url");
      const first = await readDocument(req.url, fetchImpl);
      const documents = [first.doc];
      const links = [{ label: first.doc.kind === "pdf" ? "Datasheet" : "Product page", url: first.doc.url }];
      if (first.html) {
        const sheets = datasheetLinks(first.html, first.doc.url);
        if (sheets[0]) {
          try {
            const sheet = await readDocument(sheets[0].url, fetchImpl);
            if (sheet.doc.text) documents.push({ ...sheet.doc, title: sheets[0].label });
            links.push({ label: sheets[0].label, url: sheet.doc.url });
          } catch {
            /* the page alone will do */
          }
        }
      }
      if (documents.every((d) => d.text.length < 200)) throw new LookupError("The page has almost no text (it may be built by scripts). Try the datasheet PDF link instead.", "url");
      return { documents, links, images: first.html ? productImages(first.html, first.doc.url) : [] };
    },
  };
}
