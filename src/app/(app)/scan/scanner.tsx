"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseScannedTag } from "@/lib/asset-tag";

const REGION_ID = "qr-reader";

/** Camera QR scanner with manual fallback. Opens /t/<tag> on success. */
export function Scanner() {
  const t = useTranslations("scan");
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  async function start() {
    setError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(REGION_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          const tag = parseScannedTag(text);
          if (!tag) {
            setError(t("notOurs"));
            return;
          }
          void stop().then(() => router.push(`/t/${encodeURIComponent(tag)}`));
        },
        () => {},
      );
      setRunning(true);
    } catch {
      setError(t("cameraError"));
      setRunning(false);
    }
  }

  async function stop() {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
    setRunning(false);
  }

  useEffect(() => {
    return () => {
      void stop();
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div id={REGION_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-md bg-black/90 [&_video]:w-full" style={{ minHeight: running ? 300 : 0 }} />
      <div className="flex justify-center">
        {running ? (
          <Button variant="outline" onClick={() => void stop()}>
            {t("stop")}
          </Button>
        ) : (
          <Button onClick={() => void start()}>{t("start")}</Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
      <form
        className="mx-auto flex w-full max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const tag = parseScannedTag(manual);
          if (!tag) {
            setError(t("notOurs"));
            return;
          }
          router.push(`/t/${encodeURIComponent(tag)}`);
        }}
      >
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="VG-0042" aria-label={t("manual")} autoCapitalize="characters" />
        <Button type="submit" variant="outline">
          {t("go")}
        </Button>
      </form>
    </div>
  );
}
