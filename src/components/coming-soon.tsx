import { getTranslations } from "next-intl/server";
import { EmptyState } from "./empty-state";

/** Placeholder page body for sections scheduled for a later phase. */
export async function ComingSoon({ section, phase }: { section: string; phase: number }) {
  const t = await getTranslations("comingSoon");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{section}</h1>
      <EmptyState title={t("title", { phase })} body={t("body")} />
    </div>
  );
}
