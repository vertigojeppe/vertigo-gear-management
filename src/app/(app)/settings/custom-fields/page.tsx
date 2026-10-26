import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { CUSTOM_FIELD_ENTITIES } from "@/lib/custom-fields";
import { categoryOptions } from "@/modules/inventory";
import { customFieldDefinitions } from "@/modules/settings";
import { CustomFieldDialog, DeleteCustomFieldButton } from "./forms";

export const metadata: Metadata = { title: "Extra fields" };

export default async function CustomFieldsPage() {
  await requirePermission("settings.manage");
  const t = await getTranslations("settings");
  const [rows, categories] = await Promise.all([customFieldDefinitions.listAll(), categoryOptions()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("customFields")}
        subtitle={t("customFieldsHelp")}
        crumbs={[{ label: t("title"), href: "/settings" }, { label: t("customFields") }]}
        actions={<CustomFieldDialog trigger="new" categories={categories} />}
      />
      {rows.length === 0 ? (
        <EmptyState title={t("noCustomFields")} body={t("noCustomFieldsBody")} />
      ) : (
        CUSTOM_FIELD_ENTITIES.map((entity) => {
          const list = rows.filter((r) => r.entity === entity);
          if (list.length === 0) return null;
          return (
            <section key={entity} className="flex flex-col gap-2">
              <h2 className="text-lg font-medium">{t(`entity.${entity}`)}</h2>
              <ul className="divide-y rounded-md border text-sm">
                {list.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {f.label}
                        {f.required && <span className="ml-1 text-destructive">*</span>}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        <span className="font-mono">{f.key}</span> · {t(`fieldType.${f.type as "text"}`)}
                        {f.category ? ` · ${f.category.name}` : ""}
                        {f.type === "select" && Array.isArray(f.options) ? ` · ${(f.options as string[]).join(", ")}` : ""}
                        {f.showInList ? ` · ${t("cfInList")}` : ""}
                      </span>
                    </span>
                    <CustomFieldDialog
                      trigger="edit"
                      categories={categories}
                      field={{
                        id: f.id,
                        entity: f.entity,
                        categoryId: f.categoryId,
                        key: f.key,
                        label: f.label,
                        type: f.type,
                        options: Array.isArray(f.options) ? (f.options as string[]) : [],
                        required: f.required,
                        showInList: f.showInList,
                        sortOrder: f.sortOrder,
                      }}
                    />
                    <DeleteCustomFieldButton id={f.id} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
