"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseScannedTag } from "@/lib/asset-tag";

const REGION_ID = "qr-reader";

type Problem = "insecure" | "unsupported" | "denied" | "noCamera" | "inUse" | "notOurs" | "generic";

/** Map a getUserMedia / html5-qrcode failure to a user-facing reason. */
function classify(err: unknown): { problem: Problem; detail: string } {
  const e = err as { name?: string; message?: string } | string | undefined;
  const name = typeof e === "object" && e ? (e.name ?? "") : "";
  const message = typeof e === "string" ? e : typeof e === "object" && e ? (e.message ?? "") : "";
  const text = `${name} ${message}`.toLowerCase();
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || text.includes("permission")) return { problem: "denied", detail: message };
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || text.includes("requested device not found") || text.includes("no camera"))
    return { problem: "noCamera", detail: message };
  if (name === "NotReadableError" || name === "TrackStartError" || text.includes("could not start video source") || text.includes("in use"))
    return { problem: "inUse", detail: message };
  if (name === "OverconstrainedError") return { problem: "noCamera", detail: message };
  return { problem: "generic", detail: message || String(err) };
}

/** Camera QR scanner with manual fallback. Opens /t/<tag> on success. */
export function Scanner() {
  const t = useTranslations("scan");
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<{ problem: Problem; detail?: string } | null>(null);
  const [manual, setManual] = useState("");
  // null during server render, then the real answer on the client.
  const secure = useSyncExternalStore(
    () => () => {},
    () => window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia),
    () => null,
  );
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  async function start() {
    setProblem(null);
    if (!window.isSecureContext) {
      setProblem({ problem: "insecure" });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem({ problem: "unsupported" });
      return;
    }
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
      scannerRef.current = scanner;
      const config = { fps: 10, qrbox: { width: 220, height: 220 } };
      const onScan = (text: string) => {
        const tag = parseScannedTag(text);
        if (!tag) {
          setProblem({ problem: "notOurs" });
          return;
        }
        void stop().then(() => router.push(`/t/${encodeURIComponent(tag)}`));
      };
      try {
        // Prefer the rear camera (phones). Laptops usually have no "environment"
        // camera, so fall back to the first camera the browser reports.
        await scanner.start({ facingMode: "environment" }, config, onScan, () => {});
      } catch (firstErr) {
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (cameras.length === 0) throw firstErr;
        await scanner.start(cameras[0].id, config, onScan, () => {});
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

  const problemText = problem
    ? problem.problem === "generic"
      ? `${t("cameraError")}${problem.detail ? ` (${problem.detail})` : ""}`
      : t(problem.problem)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {secure === false && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          {t("insecure")} {t("insecureHelp")}
        </p>
      )}
      <div
        id={REGION_ID}
        className="mx-auto w-full max-w-sm overflow-hidden rounded-md bg-black/90 [&_video]:w-full"
        style={{ minHeight: running ? 300 : 0 }}
      />
      <div className="flex justify-center">
        {running ? (
          <Button variant="outline" onClick={() => void stop()}>
            {t("stop")}
          </Button>
        ) : (
          <Button onClick={() => void start()} disabled={secure === false}>
            {t("start")}
          </Button>
        )}
      </div>
      {problemText && (
        <p role="alert" className="mx-auto max-w-sm text-center text-sm text-destructive">
          {problemText}
        </p>
      )}
      <form
        className="mx-auto flex w-full max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const tag = parseScannedTag(manual);
          if (!tag) {
            setProblem({ problem: "notOurs" });
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
