import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { can, requireActor } from "@/lib/auth/session";
import { CategoryDialog, DeleteCategoryButton, InventoryTabs, categoryOptions, categoryTree } from "@/modules/inventory";

export const metadata: Metadata = { title: "Categories" };

type Node = Awaited<ReturnType<typeof categoryTree>>[number];

export default async function CategoriesPage() {
  const actor = await requireActor();
  const t = await getTranslations("inventory");
  const [tree, options] = await Promise.all([categoryTree(), categoryOptions()]);
  const canEdit = can(actor.role, "inventory.write");

  const render = (nodes: Node[]) => (
    <ul className={nodes[0]?.depth ? "ml-5 border-l pl-3" : ""}>
      {nodes.map((n) => (
        <li key={n.id} className="py-1">
          <div className="flex items-center gap-3">
            <Link href={`/inventory?categoryId=${n.id}`} className="font-medium hover:underline">
              {n.name}
            </Link>
            <span className="text-xs text-muted-foreground">{t("modelsCount", { count: n._count.models })}</span>
            {canEdit && (
              <span className="ml-auto flex items-center gap-1">
                <CategoryDialog trigger="edit" category={{ id: n.id, name: n.name, parentId: n.parentId, sortOrder: n.sortOrder }} parents={options} />
                {n._count.models === 0 && n.children.length === 0 && <DeleteCategoryButton id={n.id} />}
              </span>
            )}
          </div>
          {n.children.length > 0 && render(n.children)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("title")} actions={canEdit && <CategoryDialog trigger="new" parents={options} />} />
      <InventoryTabs />
      {tree.length === 0 ? <EmptyState title={t("noCategories")} body={t("noCategoriesBody")} /> : <div className="rounded-md border px-4 py-2 text-sm">{render(tree)}</div>}
    </div>
  );
}
