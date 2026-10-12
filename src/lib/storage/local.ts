import { createReadStream } from "node:fs";
import { access, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { StorageAdapter } from "./index";

/** Stores files on a local disk volume. Default driver. */
export class LocalStorage implements StorageAdapter {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    const rootAbs = path.resolve(this.root);
    if (!full.startsWith(rootAbs + path.sep) && full !== rootAbs) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async put(key: string, data: Buffer | Uint8Array): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async stream(key: string): Promise<ReadableStream<Uint8Array>> {
    const nodeStream = createReadStream(this.resolve(key));
    return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  /* Resumable uploads: a part file grows chunk by chunk, then moves into place. */

  async appendPart(partKey: string, offset: number, chunk: Buffer | Uint8Array): Promise<number> {
    const full = this.resolve(partKey);
    await mkdir(path.dirname(full), { recursive: true });
    const fh = await open(full, "a+");
    try {
      const { size } = await fh.stat();
      if (size !== offset) throw new Error(`Chunk out of order: have ${size} bytes, got offset ${offset}`);
      await fh.write(chunk, 0, chunk.length, offset);
      return size + chunk.length;
    } finally {
      await fh.close();
    }
  }

  async partSize(partKey: string): Promise<number> {
    try {
      return (await stat(this.resolve(partKey))).size;
    } catch {
      return 0;
    }
  }

  async finalizePart(partKey: string, key: string): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await rename(this.resolve(partKey), full);
  }
}
