import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { clientOptions } from "@/modules/projects";
import { RentalForm } from "@/modules/rentals";
import { customFieldDefinitions } from "@/modules/settings";

export const metadata: Metadata = { title: "New rental" };

export default async function NewRentalPage() {
  await requirePermission("rentals.write");
  const t = await getTranslations("rentals");
  const [clients, defs] = await Promise.all([clientOptions(), customFieldDefinitions.forEntity("rental")]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("newRental")} crumbs={[{ label: t("title"), href: "/rentals" }, { label: t("newRental") }]} />
      <RentalForm clients={clients} defs={defs} />
    </div>
  );
}
