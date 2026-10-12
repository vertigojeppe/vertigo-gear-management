"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Problem = "insecure" | "unsupported" | "denied" | "noCamera" | "inUse" | "generic";

function classify(err: unknown): { problem: Problem; detail: string } {
  const e = err as { name?: string; message?: string } | string | undefined;
  const name = typeof e === "object" && e ? (e.name ?? "") : "";
  const message = typeof e === "string" ? e : typeof e === "object" && e ? (e.message ?? "") : "";
  const text = `${name} ${message}`.toLowerCase();
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || text.includes("permission")) return { problem: "denied", detail: message };
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError" || text.includes("requested device not found")) return { problem: "noCamera", detail: message };
  if (name === "NotReadableError" || name === "TrackStartError" || text.includes("could not start video source") || text.includes("in use")) return { problem: "inUse", detail: message };
  return { problem: "generic", detail: message || String(err) };
}

/**
 * Camera QR reader. Calls onScan(text) for every decoded code (debounced
 * per code so holding a tag in view does not fire repeatedly). Explains
 * why the camera cannot start instead of failing silently.
 */
export function QrScanner({ onScan, id = "qr-reader" }: { onScan: (text: string) => void; id?: string }) {
  const t = useTranslations("scan");
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<{ problem: Problem; detail?: string } | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  const secure = useSyncExternalStore(
    () => () => {},
    () => window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia),
    () => null,
  );

  async function start() {
    setProblem(null);
    if (!window.isSecureContext) return setProblem({ problem: "insecure" });
    if (!navigator.mediaDevices?.getUserMedia) return setProblem({ problem: "unsupported" });
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(id, { verbose: false });
      scannerRef.current = scanner;
      const config = { fps: 10, qrbox: { width: 220, height: 220 } };
      const handle = (text: string) => {
        const now = Date.now();
        if (lastRef.current.text === text && now - lastRef.current.at < 3000) return;
        lastRef.current = { text, at: now };
        onScanRef.current(text);
      };
      try {
        await scanner.start({ facingMode: "environment" }, config, handle, () => {});
      } catch (firstErr) {
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (cameras.length === 0) throw firstErr;
        await scanner.start(cameras[0].id, config, handle, () => {});
      }
      setRunning(true);
    } catch (err) {
      scannerRef.current = null;
      setProblem(classify(err));
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

  const problemText = problem ? (problem.problem === "generic" ? `${t("cameraError")}${problem.detail ? ` (${problem.detail})` : ""}` : t(problem.problem)) : null;

  return (
    <div className="flex flex-col gap-3">
      {secure === false && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {t("insecure")} {t("insecureHelp")}
        </p>
      )}
      <div id={id} className="mx-auto w-full max-w-sm overflow-hidden rounded-md bg-black/90 [&_video]:w-full" style={{ minHeight: running ? 260 : 0 }} />
      <div className="flex justify-center">
        {running ? (
          <Button variant="outline" size="sm" onClick={() => void stop()}>
            {t("stop")}
          </Button>
        ) : (
          <Button size="sm" onClick={() => void start()} disabled={secure === false}>
            {t("start")}
          </Button>
        )}
      </div>
      {problemText && (
        <p role="alert" className="text-center text-sm text-destructive">
          {problemText}
        </p>
      )}
    </div>
  );
}
