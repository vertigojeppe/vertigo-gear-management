import type { Db } from "@/lib/db";
import { appConfig } from "../../config/app.config";

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

/**
 * Next asset tag, e.g. VG-0042. Uses an atomic counter row so concurrent
 * item creation never produces duplicates. Call inside the transaction that
 * creates the item.
 */
export async function nextAssetTag(db: Tx | Db): Promise<string> {
  const row = await db.counter.upsert({
    where: { key: "asset_tag" },
    create: { key: "asset_tag", value: 1 },
    update: { value: { increment: 1 } },
  });
  return formatAssetTag(row.value);
}

export function formatAssetTag(n: number): string {
  return `${appConfig.assetTagPrefix}-${String(n).padStart(4, "0")}`;
}

/** Normalise user input ("vg-42", " VG-0042 ") to the canonical form. */
export function normaliseAssetTag(input: string): string | null {
  const m = input.trim().toUpperCase().match(/^([A-Z]+)-?0*(\d+)$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(4, "0")}`;
}

/**
 * Full URL encoded in the QR code; opens the item page after login.
 * Uses APP_URL (the public address, set in production). When APP_URL is
 * unset or points at localhost, falls back to the origin the request came
 * from, so a phone on the local network gets a URL it can open.
 */
export function assetTagUrl(tag: string, requestOrigin?: string): string {
  const configured = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const isLocal = !configured || /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(configured);
  const base = isLocal && requestOrigin ? requestOrigin.replace(/\/$/, "") : configured || "http://localhost:3000";
  return `${base}/t/${encodeURIComponent(tag)}`;
}

/** Extract an asset tag from a scanned string (our URL or a bare tag). */
export function parseScannedTag(text: string): string | null {
  const trimmed = text.trim();
  const urlMatch = trimmed.match(/\/t\/([^/?#]+)/);
  if (urlMatch) return normaliseAssetTag(decodeURIComponent(urlMatch[1]));
  return normaliseAssetTag(trimmed);
}
