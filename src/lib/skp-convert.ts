import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

/**
 * SketchUp files to GLB with OpenSKP (scripts/skp-to-glb.py), so a .skp plan
 * document opens in the 3D viewer. The Docker image has Python with OpenSKP
 * in /opt/skp (SKP_PYTHON); elsewhere point SKP_PYTHON at a Python that has
 * `openskp` and `pillow`, otherwise conversion is simply unavailable.
 */
export type SkpConverter = (bytes: Buffer) => Promise<Buffer | null>;

const run = promisify(execFile);
const python = () => process.env.SKP_PYTHON || "python3";
const script = () => process.env.SKP_SCRIPT || path.join(process.cwd(), "scripts", "skp-to-glb.py");
let available: boolean | null = null;

/** Is a Python with OpenSKP on this machine? */
export async function skpConvertAvailable(): Promise<boolean> {
  if (available !== null) return available;
  try {
    await run(python(), ["-I", "-c", "import openskp, PIL"], { timeout: 60_000 });
    available = true;
  } catch {
    available = false;
  }
  return available;
}

// One conversion at a time: a big site model takes a lot of memory.
let queue: Promise<unknown> = Promise.resolve();

/** The GLB of a SketchUp file, or null when OpenSKP is missing or cannot read it. */
export const convertSkp: SkpConverter = (bytes) => {
  const job = queue.then(async () => {
    if (!(await skpConvertAvailable())) return null;
    const dir = await mkdtemp(path.join(os.tmpdir(), "vg-skp-"));
    try {
      const src = path.join(dir, "in.skp");
      const out = path.join(dir, "out.glb");
      await writeFile(src, bytes);
      await run(python(), ["-I", script(), src, out], { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });
      return await readFile(out);
    } catch {
      return null;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  queue = job.catch(() => undefined);
  return job;
};
