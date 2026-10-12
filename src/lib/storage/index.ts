import { LocalStorage } from "./local";

/**
 * Storage adapter interface. Everything that stores bytes (photos, invoices,
 * manuals, drawings, 3D files) goes through this, so switching from local
 * disk to S3/R2 is a config change (STORAGE_DRIVER=s3).
 */
export interface StorageAdapter {
  /** Store bytes under a key. */
  put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<void>;
  /** Read bytes back. Throws if missing. */
  get(key: string): Promise<Buffer>;
  /** Readable stream for large files. */
  stream(key: string): Promise<ReadableStream<Uint8Array>>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Resumable uploads: append a chunk at the expected offset; returns the new size. */
  appendPart(partKey: string, offset: number, chunk: Buffer | Uint8Array): Promise<number>;
  /** Bytes received so far for a part (0 when it does not exist). */
  partSize(partKey: string): Promise<number>;
  /** Move a finished part to its final key. */
  finalizePart(partKey: string, key: string): Promise<void>;
}

let adapter: StorageAdapter | undefined;

export function getStorage(): StorageAdapter {
  if (adapter) return adapter;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "local") {
    adapter = new LocalStorage(process.env.UPLOAD_DIR ?? "./uploads");
  } else if (driver === "s3") {
    // S3 needs a multipart implementation of appendPart/finalizePart; not written yet.
    throw new Error("STORAGE_DRIVER=s3 is not available yet. Use local.");
  } else {
    throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
  }
  return adapter;
}

/** Build a storage key: yyyy/mm/<id>.<ext>, safe for any backend. */
export function storageKeyFor(id: string, filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}/${mm}/${id}${ext ? "." + ext : ""}`;
}
