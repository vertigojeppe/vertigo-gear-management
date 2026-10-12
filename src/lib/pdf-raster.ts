import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
let available: boolean | null = null;

/** Is poppler's pdftoppm on this machine? (The Docker image has it.) */
export async function pdfRasterAvailable(): Promise<boolean> {
  if (available !== null) return available;
  try {
    await run("pdftoppm", ["-v"]);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/**
 * Render one page of a PDF to PNG at ~`dpi`, for embedding drawings with
 * their markup in the plan PDF. Returns null when pdftoppm is missing.
 */
export async function rasterizePdfPage(pdf: Buffer, page: number, dpi = 72): Promise<Buffer | null> {
  if (!(await pdfRasterAvailable())) return null;
  const dir = await mkdtemp(path.join(os.tmpdir(), "vg-pdf-"));
  try {
    const src = path.join(dir, "in.pdf");
    await writeFile(src, pdf);
    const out = path.join(dir, "page");
    await run("pdftoppm", ["-png", "-r", String(dpi), "-f", String(page), "-l", String(page), "-singlefile", src, out]);
    return await readFile(`${out}.png`);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
