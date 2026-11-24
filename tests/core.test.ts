import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityNode, AppDocument, Result } from "../src/types";
import { createSeedDocument } from "../src/data/seed";
import {
  addNode,
  countNodes,
  findNode,
  removeNode,
  updateNode,
} from "../src/utils/tree";
import { chooseResult, eligibleLeaves } from "../src/utils/random";
import {
  isSafeUrl,
  parseDocument,
  readDocument,
  saveDocument,
  serializeDocument,
  STORAGE_KEY,
} from "../src/services/storage";
const leaf = (id: string, enabled = true): ActivityNode => ({
  id,
  title: id,
  enabled,
  kind: "activity",
  children: [],
  variants: [],
  resources: [],
});
const group = (
  id: string,
  children: ActivityNode[],
  enabled = true,
): ActivityNode => ({ ...leaf(id, enabled), kind: "group", children });
const tree = () => [
  group("a", [leaf("a1"), group("a2", [leaf("a21"), leaf("a22")])]),
  group("b", [leaf("b1")]),
];
const document = (nodes = tree()): AppDocument => ({
  schemaVersion: 1,
  nodes,
  history: [],
  settings: { autoSaveHistory: true },
});
beforeEach(() => localStorage.clear());
describe("Cây và random", () => {
  it("loại nhánh tắt kế thừa, lá tắt và nhóm rỗng", () => {
    expect(
      eligibleLeaves([
        group("off", [leaf("hidden")], false),
        group("empty", []),
        leaf("off-leaf", false),
        leaf("yes"),
      ]).map((p) => p.at(-1)?.id),
    ).toEqual(["yes"]);
  });
  it("xử lý 0 hoặc 1 lựa chọn", () => {
    expect(chooseResult([])).toBeNull();
    const first = chooseResult([leaf("single")])!;
    expect(chooseResult([leaf("single")], { previous: first })).toEqual(first);
  });
  it("chia đều các khoảng xác suất cho từng lá, độc lập độ sâu", () => {
    const ids = [0, 1, 2, 3].map(
      (i) => chooseResult(tree(), { rng: () => (i + 0.5) / 4 })?.activity.id,
    );
    expect(ids).toEqual(["a1", "a21", "a22", "b1"]);
  });
  it("lọc theo gốc và không random ra ngoài nhóm", () => {
    for (let i = 0; i < 50; i++)
      expect(
        chooseResult(tree(), { scopeId: "b" })?.path.map((p) => p.id),
      ).toEqual(["b", "b1"]);
    expect(chooseResult(tree(), { scopeId: "missing" })).toBeNull();
  });
  it("không lặp ngay hoạt động khi có ít nhất hai lựa chọn", () => {
    let previous: Result | undefined;
    for (let i = 0; i < 200; i++) {
      const next = chooseResult(tree(), { previous, rng: () => 0 })!;
      expect(next.activity.id).not.toBe(previous?.activity.id);
      previous = next;
    }
  });
  it("random suffix giữ đúng prefix ở mọi cấp", () => {
    const previous = chooseResult(tree(), { rng: () => 0.4 })!;
    expect(previous.activity.id).toBe("a21");
    for (let level = 0; level < previous.path.length; level++) {
      for (let i = 0; i < 20; i++) {
        const next = chooseResult(tree(), { previous, fromLevel: level })!;
        expect(next.path.slice(0, level)).toEqual(
          previous.path.slice(0, level),
        );
        expect(
          eligibleLeaves(tree()).some(
            (p) =>
              p.map((n) => n.id).join() === next.path.map((n) => n.id).join(),
          ),
        ).toBe(true);
      }
    }
  });
  it("từ chối cấp không hợp lệ và prefix không còn hiệu lực", () => {
    const previous = chooseResult(tree(), { rng: () => 0.4 })!;
    expect(chooseResult(tree(), { previous, fromLevel: 9 })).toBeNull();
    expect(chooseResult([], { previous, fromLevel: 1 })).toBeNull();
  });
  it("giữ variant/resources đúng chủ sở hữu, không sửa nguồn", () => {
    const a = leaf("art");
    a.variants = [
      {
        id: "v1",
        title: "v1",
        resources: [{ id: "r1", type: "text", title: "r1", content: "one" }],
      },
      {
        id: "v2",
        title: "v2",
        resources: [{ id: "r2", type: "text", title: "r2", content: "two" }],
      },
    ];
    const result = chooseResult([a], { rng: () => 0 })!;
    expect(result.variant?.resources[0].content).toBe("one");
    const next = chooseResult([a], { previous: result, rng: () => 0 })!;
    expect(next.variant?.resources[0].content).toBe("two");
    result.activity.title = "changed";
    expect(a.title).toBe("art");
  });
  it("CRUD nhiều cấp bất biến và ngăn thêm con vào lá", () => {
    const nodes = tree();
    const before = JSON.stringify(nodes);
    const added = addNode(nodes, "a2", leaf("new"));
    expect(findNode(added, "a2")?.children.at(-1)?.id).toBe("new");
    const updated = updateNode(added, "new", (n) => ({
      ...n,
      title: "Renamed",
      variants: [{ id: "v", title: "V", resources: [] }],
    }));
    expect(findNode(updated, "new")?.title).toBe("Renamed");
    expect(findNode(removeNode(updated, "a2"), "new")).toBeUndefined();
    expect(JSON.stringify(nodes)).toBe(before);
    expect(() => addNode(nodes, "a1", leaf("bad"))).toThrow();
  });
});
describe("Lưu trữ và kiểm tra nhập", () => {
  it("seed đủ ba nhóm, kiến thức có ít nhất 2 nhánh nhỏ mỗi lĩnh vực", () => {
    const doc = createSeedDocument();
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(doc.nodes.map((n) => n.title)).toEqual([
      "Nội trợ",
      "Nghệ thuật",
      "Kiến thức",
    ]);
    expect(doc.nodes[2].children).toHaveLength(7);
    doc.nodes[2].children.forEach((n) =>
      expect(n.children.length).toBeGreaterThanOrEqual(2),
    );
    expect(countNodes(doc.nodes).activities).toBeGreaterThan(40);
  });
  it("CRUD, export/import và reload giữ chính xác toàn bộ dữ liệu", () => {
    let doc = document();
    doc.nodes = addNode(doc.nodes, "a2", {
      ...leaf("new"),
      variants: [
        {
          id: "variant",
          title: "V",
          resources: [
            {
              id: "resource",
              title: "Nội dung",
              type: "text",
              content: "Một đoạn văn.",
            },
          ],
        },
      ],
    });
    doc.nodes = updateNode(doc.nodes, "new", (n) => ({
      ...n,
      description: "Mô tả mới",
    }));
    doc.nodes = removeNode(doc.nodes, "a1");
    const result = chooseResult(doc.nodes)!;
    doc.history.push({
      id: "history",
      createdAt: new Date().toISOString(),
      completed: true,
      result,
    });
    saveDocument(doc);
    expect(readDocument()).toEqual(doc);
    const backup = serializeDocument(doc);
    localStorage.clear();
    saveDocument(parseDocument(backup));
    expect(readDocument()).toEqual(doc);
  });
  it("lịch sử snapshot không phụ thuộc sửa/xóa node và variant gốc", () => {
    const doc = document();
    const result = chooseResult(doc.nodes)!;
    doc.history = [
      {
        id: "history",
        createdAt: new Date().toISOString(),
        completed: false,
        result,
      },
    ];
    const before = structuredClone(doc.history);
    doc.nodes = removeNode(
      updateNode(doc.nodes, result.activity.id, (n) => ({
        ...n,
        title: "Đã sửa",
      })),
      result.path[0].id,
    );
    expect(doc.history).toEqual(before);
    expect(parseDocument(serializeDocument(doc)).history).toEqual(before);
  });
  it("JSON hỏng và schema sai không phá dữ liệu cũ", () => {
    const doc = document();
    saveDocument(doc);
    for (const raw of [
      "{",
      "{}",
      '{"schemaVersion":99}',
      JSON.stringify({ ...doc, nodes: [{ ...leaf("x"), enabled: "yes" }] }),
    ]) {
      expect(() => parseDocument(raw)).toThrow();
      expect(readDocument()).toEqual(doc);
    }
  });
  it("không tự reset localStorage lỗi hay version mới", () => {
    localStorage.setItem(STORAGE_KEY, '{"schemaVersion":2}');
    expect(() => readDocument()).toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"schemaVersion":2}');
  });
  it("từ chối ID trùng và hoạt động có con", () => {
    expect(() =>
      parseDocument(serializeDocument(document([leaf("x"), leaf("x")]))),
    ).toThrow();
    expect(() =>
      parseDocument(
        serializeDocument(document([{ ...leaf("x"), children: [leaf("y")] }])),
      ),
    ).toThrow();
  });
  it("chặn URL nguy hiểm ở tài nguyên chung, variant và lịch sử", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:image/png;base64,abc",
      "file:///a",
      "/relative",
      "https://user:password@example.com",
    ])
      expect(isSafeUrl(url)).toBe(false);
    expect(isSafeUrl("https://example.com/a")).toBe(true);
    for (const where of ["common", "variant", "history"]) {
      const n = leaf("x");
      const resource = {
        id: "res",
        title: "Link",
        type: "link" as const,
        url: "javascript:alert(1)",
      };
      if (where === "variant")
        n.variants = [{ id: "v", title: "V", resources: [resource] }];
      else n.resources = [resource];
      const doc = document(where === "history" ? [] : [n]);
      if (where === "history")
        doc.history = [
          {
            id: "h",
            createdAt: new Date().toISOString(),
            completed: false,
            result: { path: [{ id: n.id, title: n.title }], activity: n },
          },
        ];
      expect(() => parseDocument(serializeDocument(doc))).toThrow();
    }
  });
  it("báo lỗi quota cho bên gọi xử lý", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Quota", "QuotaExceededError");
    });
    expect(() => saveDocument(document())).toThrow();
  });
});
