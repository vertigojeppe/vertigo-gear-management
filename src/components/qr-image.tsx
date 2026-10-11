"use client";

import { useSyncExternalStore } from "react";

/**
 * QR image for an item. Passes the browser's own origin to the server so
 * the encoded URL matches the address the user is actually on (needed in
 * development, where the server only knows itself as localhost). In
 * production APP_URL wins and the parameter is ignored.
 */
export function QrImage({ itemId, assetTag, className }: { itemId: string; assetTag: string; className?: string }) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const src = `/api/items/${itemId}/qr.svg${origin ? `?origin=${encodeURIComponent(origin)}` : ""}`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`QR ${assetTag}`} width={160} height={160} className={className} />;
}
