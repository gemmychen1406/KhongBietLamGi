import type { ActivityNode, Resource, Variant } from "../types";
import { api, publicImageUrl } from "./supabase";
export type Row = Record<string, string | boolean | null> & { id: string };
export type Tables = Record<
  "activity_nodes" | "activity_variants" | "resources",
  Row[]
>;
export interface Change {
  table: keyof Tables;
  op: "insert" | "update" | "delete";
  data: Row;
  before?: Row;
}
export function flatten(nodes: ActivityNode[], userId: string): Tables {
  const rows: Tables = {
    activity_nodes: [],
    activity_variants: [],
    resources: [],
  };
  const resources = (
    rs: Resource[],
    nodeId: string,
    variantId: string | null,
  ) =>
    rs.forEach((r) =>
      rows.resources.push({
        id: r.id,
        node_id: nodeId,
        variant_id: variantId,
        created_by: r.createdBy ?? userId,
        title: r.title,
        type: r.type,
        url: r.url || null,
        content: r.content || null,
      }),
    );
  const visit = (ns: ActivityNode[], parent: string | null) =>
    ns.forEach((n) => {
      rows.activity_nodes.push({
        id: n.id,
        parent_id: parent,
        created_by: n.createdBy ?? userId,
        title: n.title,
        description: n.description || null,
        kind: n.kind,
        enabled: n.enabled,
      });
      resources(n.resources, n.id, null);
      n.variants.forEach((v) => {
        rows.activity_variants.push({
          id: v.id,
          node_id: n.id,
          created_by: v.createdBy ?? userId,
          title: v.title,
          description: v.description || null,
        });
        resources(v.resources, n.id, v.id);
      });
      visit(n.children, n.id);
    });
  visit(nodes, null);
  return rows;
}
export function changesBetween(before: Tables, after: Tables): Change[] {
  const changes: Change[] = [];
  const tables = ["activity_nodes", "activity_variants", "resources"] as const;
  for (const table of [...tables].reverse()) {
    for (const row of [...before[table]].reverse())
      if (!after[table].some((r) => r.id === row.id))
        changes.push({ table, op: "delete", data: row, before: row });
  }
  for (const table of tables)
    for (const row of after[table]) {
      const old = before[table].find((r) => r.id === row.id);
      if (!old) changes.push({ table, op: "insert", data: row });
      else if (JSON.stringify(old) !== JSON.stringify(row))
        changes.push({ table, op: "update", data: row, before: old });
    }
  return changes;
}
export function assemble(
  rows: Tables,
  names: Map<string, string>,
): ActivityNode[] {
  const attr = (r: Row) => ({
    createdBy: String(r.created_by),
    contributorName: names.get(String(r.created_by)) ?? "Thành viên",
  });
  const rs = (node: string, variant: string | null): Resource[] =>
    rows.resources
      .filter((r) => r.node_id === node && r.variant_id === variant)
      .map((r) => ({
        id: r.id,
        title: String(r.title),
        type: r.type as Resource["type"],
        url: r.url ? String(r.url) : undefined,
        content: r.content ? String(r.content) : undefined,
        ...attr(r),
      }));
  const nodes = new Map<string, ActivityNode>();
  rows.activity_nodes.forEach((r) => {
    const variants: Variant[] = rows.activity_variants
      .filter((v) => v.node_id === r.id)
      .map((v) => ({
        id: v.id,
        title: String(v.title),
        description: v.description ? String(v.description) : undefined,
        resources: rs(r.id, v.id),
        ...attr(v),
      }));
    nodes.set(r.id, {
      id: r.id,
      title: String(r.title),
      description: r.description ? String(r.description) : undefined,
      kind: r.kind as ActivityNode["kind"],
      enabled: Boolean(r.enabled),
      children: [],
      variants,
      resources: rs(r.id, null),
      ...attr(r),
    });
  });
  const roots: ActivityNode[] = [];
  rows.activity_nodes.forEach((r) => {
    const n = nodes.get(r.id)!;
    if (r.parent_id) {
      const parent = nodes.get(String(r.parent_id));
      if (!parent) throw new Error("Thiếu nhóm cha trong dữ liệu tải về.");
      parent.children.push(n);
    } else roots.push(n);
  });
  return roots;
}
// Page every table: Supabase's default response limit must not silently truncate the tree.
async function allRows(table: string): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 500) {
    const data = await api<Record<string, unknown>[]>(
      `/rest/v1/${table}?select=*&order=id&offset=${offset}&limit=500`,
    );
    result.push(...data);
    if (data.length < 500) return result;
  }
}
export async function loadLibrary() {
  const [nodes, variants, resources, profiles] = await Promise.all(
    ["activity_nodes", "activity_variants", "resources", "profiles"].map(
      allRows,
    ),
  );
  return assemble(
    {
      activity_nodes: nodes as Row[],
      activity_variants: variants as Row[],
      resources: resources as Row[],
    },
    new Map(profiles.map((p) => [String(p.id), String(p.display_name)])),
  );
}
export async function saveLibrary(
  before: ActivityNode[],
  after: ActivityNode[],
  userId: string,
) {
  const changes = changesBetween(
    flatten(before, userId),
    flatten(after, userId),
  );
  if (!changes.length) return;
  await api("/rest/v1/rpc/apply_community_changes", {
    method: "POST",
    body: JSON.stringify({ changes }),
  });
}
export async function uploadImage(file: File, userId: string) {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
      file.type,
    ) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Chỉ nhận JPEG, PNG, WebP, GIF tối đa 5 MB.");
  const path = `${userId}/${crypto.randomUUID()}`;
  await api(`/storage/v1/object/activity-images/${path}`, {
    method: "POST",
    body: file,
    headers: { "Content-Type": file.type, "x-upsert": "false" },
  });
  return publicImageUrl(path);
}
export async function deleteImage(path: string) {
  const removed = await api<{ name: string }[]>(
    "/storage/v1/object/activity-images",
    {
      method: "DELETE",
      body: JSON.stringify({ prefixes: [path] }),
    },
  );
  if (!removed?.length)
    throw new Error(
      "Ảnh không tồn tại hoặc bạn không có quyền xóa. Hãy tải lại danh sách.",
    );
}
