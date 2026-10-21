/**
 * Browser side of the chunked, resumable uploads (POST /api/uploads, PUT
 * chunks, complete): every chunk is retried on its own, and after a failed
 * chunk the client asks the server how far it got. Returns the new File id;
 * attaching it to something is the caller's server action.
 */
export async function uploadFile(file: File, onProgress: (done: number) => void): Promise<{ fileId: string }> {
  const start = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size }) });
  if (!start.ok) throw new Error((await start.json().catch(() => ({})))?.error ?? `Upload could not start (${start.status})`);
  const { id, chunkSize } = (await start.json()) as { id: string; chunkSize: number };
  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(file.size, offset + chunkSize));
    let attempt = 0;
    for (;;) {
      try {
        const res = await fetch(`/api/uploads/${id}?offset=${offset}`, { method: "PUT", body: chunk, headers: { "Content-Type": "application/octet-stream" } });
        if (res.status === 409) {
          // Out of sync (a retry already landed?): ask where the server is and continue from there.
          const st = await fetch(`/api/uploads/${id}`);
          if (!st.ok) throw new Error("Upload lost. Try again.");
          offset = ((await st.json()) as { received: number }).received;
          break;
        }
        if (!res.ok) throw new Error(`Chunk failed (${res.status})`);
        offset = ((await res.json()) as { received: number }).received;
        break;
      } catch (err) {
        if (++attempt > 4) throw err instanceof Error ? err : new Error(String(err));
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    onProgress(offset);
  }
  const done = await fetch(`/api/uploads/${id}/complete`, { method: "POST" });
  if (!done.ok) throw new Error((await done.json().catch(() => ({})))?.error ?? `Upload could not complete (${done.status})`);
  return (await done.json()) as { fileId: string };
}
