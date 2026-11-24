import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("../src/services/supabase", () => ({
  publicApi: vi.fn(),
  api: vi.fn(),
  publicImageUrl: vi.fn(),
}));
import { publicApi } from "../src/services/supabase";
import {
  loadLibrary,
  assemble,
  flatten,
  changesBetween,
  type Tables,
} from "../src/services/community";
import { canEdit, canContribute } from "../src/services/permissions";
import type { ActivityNode, AppDocument } from "../src/types";
import { createSeedDocument } from "../src/data/seed";
import { parseDocument } from "../src/services/storage";
import { asNewContributions } from "../src/App";
const read = vi.mocked(publicApi);
beforeEach(() => {
  read.mockReset();
});
function records(): Tables {
  const rows = flatten(createSeedDocument().nodes, "A");
  for (const rs of Object.values(rows))
    for (const r of rs) {
      r.created_by = null;
      r.system_seed_key = r.id;
    }
  return rows;
}
describe("Tải thư viện công khai", () => {
  it("snapshot RPC tải đủ dữ liệu và quyền sở hữu Hệ thống", async () => {
    const rows = records();
    read.mockResolvedValue({ ...rows, profiles: [] });
    const nodes = await loadLibrary();
    expect(nodes.map((n) => n.title)).toEqual([
      "Nội trợ",
      "Nghệ thuật",
      "Kiến thức",
    ]);
    expect(nodes[0].contributorName).toBe("Hệ thống");
    expect(nodes[0].createdBy).toBeUndefined();
    expect(nodes[0].systemSeedKey).toBeTruthy();
    expect(read).toHaveBeenCalledTimes(1);
    expect(
      canEdit({ userId: "A", admin: false, community: true }, nodes[0]),
    ).toBe(true);
    expect(
      canEdit({ userId: "A", admin: true, community: true }, nodes[0]),
    ).toBe(true);
    expect(
      canContribute({
        userId: "A",
        admin: true,
        community: true,
        readOnly: true,
      }),
    ).toBe(false);
  });
  it("khi chưa có 002: phân trang đến rỗng kể cả server giới hạn ít hơn 500", async () => {
    const rows = records();
    read.mockImplementation(async (path) => {
      if (path.includes("/rpc/")) throw { code: "PGRST202" };
      const url = new URL(path, "https://test.supabase.co");
      const table = url.pathname.split("/").at(-1)!;
      if (table === "profiles") throw { code: "42501" };
      const data = rows[table as keyof Tables];
      const offset = Number(url.searchParams.get("offset"));
      return data.slice(offset, offset + 2);
    });
    const nodes = await loadLibrary();
    expect(flatten(nodes, "A")).toEqual(rows);
    expect(read.mock.calls.length).toBeGreaterThan(40);
  });
  it("lỗi quyền thật không bị coi là thiếu RPC để che lỗi bằng dữ liệu rỗng", async () => {
    read.mockRejectedValue({ code: "42501" });
    await expect(loadLibrary()).rejects.toMatchObject({ code: "42501" });
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("phản hồi malformed, chu trình và thiếu nhóm cha đều được phát hiện", async () => {
    read.mockResolvedValue({ activity_nodes: null });
    await expect(loadLibrary()).rejects.toThrow("không hợp lệ");
    const rows = records();
    const a = rows.activity_nodes[0];
    a.parent_id = "missing";
    expect(() => assemble(rows, new Map())).toThrow("Thiếu nhóm cha");
    a.parent_id = a.id;
    expect(() => assemble(rows, new Map())).toThrow("chu trình");
  });
  it("tài nguyên gắn sai variant bị phát hiện, không hiển thị dưới hoạt động khác", () => {
    const rows = records();
    const resource = rows.resources[0];
    resource.variant_id = "missing";
    expect(() => assemble(rows, new Map())).toThrow("không thuộc đúng");
  });
  it("thêm đóng góp trên hoạt động hệ thống không tạo UPDATE/đổi chủ sở hữu hệ thống", () => {
    const rows = records();
    const nodes = assemble(rows, new Map());
    const before = flatten(nodes, "Member");
    function find(ns: ActivityNode[]): ActivityNode {
      for (const n of ns) {
        if (n.kind === "activity") return n;
        if (n.children.length) return find(n.children);
      }
      throw new Error("No activity");
    }
    find(nodes).resources.push({
      id: "new",
      type: "text",
      title: "Đóng góp thật",
      content: "Bắt đầu ở đây",
    });
    const changes = changesBetween(before, flatten(nodes, "Member"));
    expect(changes).toHaveLength(1);
    expect(changes[0].table).toBe("resources");
    expect(changes[0].data.created_by).toBe("Member");
  });
  it("backup nguồn hệ thống roundtrip hợp lệ, import bỏ mọi dấu quyền hệ thống", () => {
    const doc: AppDocument = {
      ...createSeedDocument(),
      nodes: assemble(records(), new Map()),
    };
    const restored = parseDocument(JSON.stringify(doc));
    expect(restored.nodes[0].systemSeedKey).toBeTruthy();
    for (const rows of Object.values(
      flatten(asNewContributions(restored.nodes), "Member"),
    ))
      for (const row of rows) {
        expect(row.created_by).toBe("Member");
        expect(row.system_seed_key).toBeUndefined();
      }
  });
});
