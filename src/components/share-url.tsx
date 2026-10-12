"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Shows a share link with the origin the browser is actually using
 * (https, LAN address, public domain), rather than APP_URL or the server's
 * own idea of its hostname. Same reasoning as the QR codes.
 */
export function ShareUrl({ path }: { path: string }) {
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => null,
  );
  const url = origin ? `${origin}${path}` : path;
  return (
    <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs" title={url}>
      {url}
    </code>
  );
}
