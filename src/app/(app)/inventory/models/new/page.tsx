import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { familyLabel } from "@/lib/format";
import { requirePermission } from "@/lib/auth/session";
import { categoryOptions, models, type ModelDto } from "@/modules/inventory";
import { ModelForm } from "@/modules/inventory/components/model-form";
import { customFieldDefinitions } from "@/modules/settings";
import { wishes } from "@/modules/wishlist";

export const metadata: Metadata = { title: "New model" };

export default async function NewModelPage(props: { searchParams: Promise<{ categoryId?: string; from?: string; wish?: string }> }) {
  await requirePermission("inventory.write");
  const { categoryId, from, wish: wishId } = await props.searchParams;
  const t = await getTranslations("inventory");
  // ?from=<modelId>: a new variant of an existing family, everything prefilled but the size.
  // ?wish=<wishId>: converting a wish; its fields prefilled, and saving marks the wish bought.
  const [cats, defs, sibling, wish] = await Promise.all([
    categoryOptions(),
    customFieldDefinitions.forEntity("model"),
    from ? models.get(from) : null,
    wishId ? wishes.get(wishId) : null,
  ]);
  const openWish = wish && wish.status === "open" ? wish : null;
  const prefill: Partial<ModelDto> | undefined = openWish
    ? {
        manufacturer: openWish.manufacturer,
        name: openWish.name,
        variant: openWish.variant,
        categoryId: openWish.categoryId ?? undefined,
        rentalDayPrice: openWish.rentalDayPrice === null ? null : Number(openWish.rentalDayPrice),
        notes: openWish.notes,
        links: openWish.link ? [{ label: "Link", url: openWish.link }] : [],
      }
    : (sibling ?? undefined);
  const title = sibling ? t("newVariantOf", { name: familyLabel(sibling) }) : openWish ? t("newModelFromWish") : t("newModel");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} crumbs={[{ label: t("title"), href: "/inventory" }, { label: title }]} />
      <ModelForm categories={cats} defs={defs} defaultCategoryId={categoryId ?? prefill?.categoryId} prefill={prefill} wishId={openWish?.id} />
    </div>
  );
}
