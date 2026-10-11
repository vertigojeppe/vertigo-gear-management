/** Pure helpers for category and location trees. */

export type TreeRow = { id: string; name: string; parentId: string | null; sortOrder?: number };

export type TreeNode<T extends TreeRow> = T & { children: TreeNode<T>[]; depth: number };

export function buildTree<T extends TreeRow>(rows: T[]): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  for (const r of rows) byId.set(r.id, { ...r, children: [], depth: 0 });
  const roots: TreeNode<T>[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes: TreeNode<T>[], depth: number) => {
    nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    for (const n of nodes) {
      n.depth = depth;
      sortRec(n.children, depth + 1);
    }
  };
  sortRec(roots, 0);
  return roots;
}

/** Depth-first flattening, for <select> options with indentation. */
export function flattenTree<T extends TreeRow>(nodes: TreeNode<T>[]): TreeNode<T>[] {
  const out: TreeNode<T>[] = [];
  const walk = (list: TreeNode<T>[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Ids of a node and all its descendants. */
export function descendantIds<T extends TreeRow>(rows: T[], rootId: string): string[] {
  const childrenOf = new Map<string | null, T[]>();
  for (const r of rows) {
    const list = childrenOf.get(r.parentId) ?? [];
    list.push(r);
    childrenOf.set(r.parentId, list);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const c of childrenOf.get(id) ?? []) stack.push(c.id);
  }
  return out;
}

/** "Video › Projectors › Laser" style path for a node. */
export function pathNames<T extends TreeRow>(rows: T[], id: string): string[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const names: string[] = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard++ < 50) {
    names.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return names;
}

/** True if `candidateParentId` is `id` itself or one of its descendants (would create a cycle). */
export function wouldCycle<T extends TreeRow>(rows: T[], id: string, candidateParentId: string | null): boolean {
  if (!candidateParentId) return false;
  return descendantIds(rows, id).includes(candidateParentId);
}
