import { describe, expect, it } from "vitest";
import {
  assemble,
  changesBetween,
  flatten,
  type Tables,
} from "../src/services/community";
import { asNewContributions } from "../src/App";
import { createSeedDocument } from "../src/data/seed";
import { nodeSchema } from "../src/services/storage";
describe("Adapter cộng đồng", () => {
  it("import tạo ID mới, bỏ mọi quyền sở hữu trong JSON", () => {
    const source = createSeedDocument().nodes;
    source[0].createdBy = "fake-admin";
    const cloned = asNewContributions(source);
    expect(cloned[0].id).not.toBe(source[0].id);
    expect(cloned[0].createdBy).toBeUndefined();
    const rows = flatten(cloned, "member");
    for (const rs of Object.values(rows))
      for (const r of rs) expect(r.created_by).toBe("member");
    expect(
      new Set(
        Object.values(rows)
          .flat()
          .map((r) => r.id),
      ).size,
    ).toBe(Object.values(rows).flat().length);
  });
  it("roundtrip giữ đúng tác giả variant/resource khác tác giả node, trường rỗng chuẩn hóa null", () => {
    const n = createSeedDocument().nodes.find((n) => n.kind === "group")!;
    n.createdBy = "A";
    const activity = {
      id: "n",
      title: "N",
      description: "",
      kind: "activity" as const,
      enabled: true,
      createdBy: "A",
      children: [],
      variants: [
        {
          id: "v",
          title: "V",
          createdBy: "B",
          resources: [
            {
              id: "r",
              title: "R",
              type: "text" as const,
              content: "Text",
              createdBy: "C",
            },
          ],
        },
      ],
      resources: [],
    };
    const rows = flatten([activity], "A");
    expect(rows.activity_nodes[0].description).toBeNull();
    const tree = assemble(
      rows,
      new Map([
        ["A", "Người A"],
        ["B", "Người B"],
        ["C", "Người C"],
      ]),
    );
    expect(tree[0].variants[0].resources[0].createdBy).toBe("C");
    expect(tree[0].variants[0].contributorName).toBe("Người B");
    expect(flatten(tree, "A")).toEqual(rows);
    expect(nodeSchema.parse(tree[0]).createdBy).toBe("A");
  });
  it("B thêm tài nguyên không phát sinh update node/variant của A", () => {
    const activity = {
      id: "n",
      title: "N",
      kind: "activity" as const,
      enabled: true,
      createdBy: "A",
      children: [],
      variants: [],
      resources: [],
    };
    const before = flatten([activity], "B");
    const after = flatten(
      [
        {
          ...activity,
          resources: [{ id: "r", type: "text", title: "R", content: "B" }],
        },
      ],
      "B",
    );
    const changes = changesBetween(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].table).toBe("resources");
    expect(changes[0].data.created_by).toBe("B");
  });
  it("tạo cha trước con và xóa phụ thuộc trước cha", () => {
    const rows = flatten(asNewContributions(createSeedDocument().nodes), "A");
    const empty: Tables = {
      activity_nodes: [],
      activity_variants: [],
      resources: [],
    };
    const inserts = changesBetween(empty, rows);
    expect(inserts[0].table).toBe("activity_nodes");
    const deletes = changesBetween(rows, empty);
    expect(deletes[0].table).toBe("resources");
    expect(deletes.at(-1)?.table).toBe("activity_nodes");
  });
});
