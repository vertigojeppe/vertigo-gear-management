"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { QrScanner } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseScannedTag } from "@/lib/asset-tag";

/** Scan page: camera + manual entry. Opens /t/<tag> on success. */
export function Scanner() {
  const t = useTranslations("scan");
  const router = useRouter();
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  const go = (text: string) => {
    const tag = parseScannedTag(text);
    if (!tag) {
      setError(t("notOurs"));
      return;
    }
    setError(null);
    router.push(`/t/${encodeURIComponent(tag)}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <QrScanner onScan={go} />
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
      <form
        className="mx-auto flex w-full max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go(manual);
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
