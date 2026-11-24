import type { ActivityNode, Resource, Variant } from "../types";
import { api, publicApi, publicImageUrl } from "./supabase";
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
function ownership(
  item: { createdBy?: string; systemSeedKey?: string },
  userId: string,
): Record<string, string | null> {
  return item.systemSeedKey
    ? { created_by: null, system_seed_key: item.systemSeedKey }
    : { created_by: item.createdBy ?? userId };
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
        ...ownership(r, userId),
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
        ...ownership(n, userId),
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
          ...ownership(v, userId),
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
  const attr = (r: Row) =>
    r.system_seed_key
      ? {
          systemSeedKey: String(r.system_seed_key),
          contributorName: "Hệ thống",
        }
      : {
          createdBy: r.created_by ? String(r.created_by) : undefined,
          contributorName: names.get(String(r.created_by)) ?? "Thành viên",
        };
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
    if (nodes.has(r.id)) throw new Error("Dữ liệu tải về có ID trùng lặp.");
    if (r.kind !== "group" && r.kind !== "activity")
      throw new Error("Loại nhóm/hoạt động trong thư viện không hợp lệ.");
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
      if (!parent)
        throw new Error(
          "Thiếu nhóm cha trong dữ liệu tải về. Hãy tải lại thư viện.",
        );
      if (parent.kind !== "group")
        throw new Error("Nhánh cha không phải nhóm hợp lệ.");
      parent.children.push(n);
    } else roots.push(n);
  });
  const visited = new Set<string>();
  const pending = [...roots];
  while (pending.length) {
    const n = pending.pop()!;
    if (visited.has(n.id)) throw new Error("Thư viện có chu trình.");
    visited.add(n.id);
    pending.push(...n.children);
  }
  if (visited.size !== nodes.size)
    throw new Error("Thư viện có chu trình hoặc thiếu nhánh gốc.");
  const variants = new Map(rows.activity_variants.map((v) => [v.id, v]));
  if (
    variants.size !== rows.activity_variants.length ||
    new Set(rows.resources.map((r) => r.id)).size !== rows.resources.length
  )
    throw new Error("Biến thể hoặc tài nguyên bị trùng ID.");
  for (const v of rows.activity_variants)
    if (nodes.get(String(v.node_id))?.kind !== "activity")
      throw new Error("Biến thể thiếu hoạt động hợp lệ.");
  for (const r of rows.resources) {
    if (
      nodes.get(String(r.node_id))?.kind !== "activity" ||
      (r.variant_id &&
        variants.get(String(r.variant_id))?.node_id !== r.node_id)
    )
      throw new Error("Tài nguyên không thuộc đúng hoạt động/biến thể.");
  }
  return roots;
}
// Legacy compatibility until 002 is applied. Page until empty even if server caps pages below 500.
async function allRows(table: string): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  for (;;) {
    const data = await publicApi<Record<string, unknown>[]>(
      `/rest/v1/${table}?select=*&order=id&offset=${result.length}&limit=500`,
    );
    if (!Array.isArray(data))
      throw new Error("Dịch vụ trả về thư viện không hợp lệ.");
    if (!data.length) return result;
    result.push(...data);
  }
}
export async function loadLibrary() {
  type LibraryPayload = Tables & {
    profiles: { id: string; display_name: string }[];
  };
  let payload: LibraryPayload;
  try {
    payload = await publicApi<LibraryPayload>(
      "/rest/v1/rpc/get_public_library",
      { method: "POST", body: "{}" },
    );
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "PGRST202" && code !== "42883") throw error;
    const [nodes, variants, resources, profiles] = await Promise.all([
      allRows("activity_nodes"),
      allRows("activity_variants"),
      allRows("resources"),
      // Missing public display names must not prevent guests from randomizing public content.
      allRows("profiles").catch(() => []),
    ]);
    payload = {
      activity_nodes: nodes as Row[],
      activity_variants: variants as Row[],
      resources: resources as Row[],
      profiles: profiles as LibraryPayload["profiles"],
    };
  }
  if (
    !payload ||
    ![
      payload.activity_nodes,
      payload.activity_variants,
      payload.resources,
      payload.profiles,
    ].every(Array.isArray)
  )
    throw new Error(
      "Phản hồi thư viện không hợp lệ. Hãy kiểm tra cấu hình Supabase.",
    );
  return assemble(
    payload,
    new Map(
      payload.profiles.map((p) => [String(p.id), String(p.display_name)]),
    ),
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
