import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

/**
 * Word (and other office text) files to PDF with LibreOffice, so plan
 * documents in those formats get the PDF viewer, markup and a place in the
 * plan PDF. The Docker image has LibreOffice; elsewhere set SOFFICE_PATH or
 * put soffice on the PATH, otherwise conversion is simply unavailable.
 */
export type OfficeConverter = (bytes: Buffer, fileName: string) => Promise<Buffer | null>;

const run = promisify(execFile);
const soffice = () => process.env.SOFFICE_PATH || "soffice";
let available: boolean | null = null;

/** Is LibreOffice on this machine? */
export async function officeConvertAvailable(): Promise<boolean> {
  if (available !== null) return available;
  try {
    await run(soffice(), ["--version"], { timeout: 30_000 });
    available = true;
  } catch {
    available = false;
  }
  return available;
}

// One conversion at a time: LibreOffice is heavy, and the office server is small.
let queue: Promise<unknown> = Promise.resolve();

/**
 * The PDF of a Word file, or null when LibreOffice is missing or cannot
 * read it. Each run gets its own profile directory, so a stale or
 * concurrent LibreOffice never blocks it.
 */
export const convertToPdf: OfficeConverter = (bytes, fileName) => {
  const job = queue.then(async () => {
    if (!(await officeConvertAvailable())) return null;
    const dir = await mkdtemp(path.join(os.tmpdir(), "vg-office-"));
    try {
      const ext = path.extname(fileName).toLowerCase() || ".docx";
      const src = path.join(dir, `in${ext}`);
      await writeFile(src, bytes);
      const out = path.join(dir, "out");
      const profile = `file:///${path.join(dir, "profile").replace(/\\/g, "/").replace(/^\/+/, "")}`;
      await run(soffice(), ["--headless", "--norestore", "--nologo", `-env:UserInstallation=${profile}`, "--convert-to", "pdf", "--outdir", out, src], { timeout: 120_000 });
      const pdf = (await readdir(out)).find((f) => f.toLowerCase().endsWith(".pdf"));
      return pdf ? await readFile(path.join(out, pdf)) : null;
    } catch {
      return null;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  queue = job.catch(() => undefined);
  return job;
};
