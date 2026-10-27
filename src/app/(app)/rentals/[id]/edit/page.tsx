import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { clientOptions } from "@/modules/projects";
import { rentals } from "@/modules/rentals";
import { RentalForm } from "@/modules/rentals/components/rental-form";
import { customFieldDefinitions } from "@/modules/settings";

export const metadata: Metadata = { title: "Edit rental" };

export default async function EditRentalPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("rentals.write");
  const { id } = await props.params;
  const t = await getTranslations("rentals");
  const [rental, clients, defs] = await Promise.all([rentals.get(id), clientOptions(), customFieldDefinitions.forEntity("rental")]);
  if (!rental) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("editRental")} crumbs={[{ label: t("title"), href: "/rentals" }, { label: t("editRental"), href: `/rentals/${id}` }]} />
      <RentalForm rental={rental} clients={clients} defs={defs} />
    </div>
  );
}
