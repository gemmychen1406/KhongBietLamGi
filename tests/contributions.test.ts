import { expect, it } from "vitest";
import { collectContributions } from "../src/utils/contributions";
import { assemble, changesBetween, flatten } from "../src/services/community";
import type { ActivityNode } from "../src/types";
const node = (): ActivityNode => ({
  id: "n",
  title: "B",
  kind: "activity",
  createdBy: "B",
  updatedBy: "A",
  revision: 3,
  enabled: true,
  resources: [
    {
      id: "r",
      title: "A",
      type: "text",
      content: "A",
      createdBy: "A",
      revision: 4,
    },
  ],
  variants: [],
  children: [],
});
it("contributions filter by createdBy, never updatedBy; ignores all system ownership", () => {
  const result = collectContributions([node()], "A");
  expect(result.nodes).toHaveLength(0);
  expect(result.resources).toHaveLength(1);
  expect(collectContributions([node()], null).resources).toHaveLength(0);
  const forged = { ...node(), createdBy: "A", systemSeedKey: "seed" };
  expect(collectContributions([forged], "A").nodes).toHaveLength(0);
});
it("audit metadata survives a read, revision travels in optimistic snapshots and editing preserves creator", () => {
  const rows = flatten([node()], "A");
  rows.activity_nodes[0].created_at = "2026-11-23T00:00:00Z";
  rows.activity_nodes[0].updated_at = "2026-11-24T00:00:00Z";
  rows.activity_nodes[0].updated_by = "A";
  const tree = assemble(
    rows,
    new Map([
      ["A", "Người A"],
      ["B", "Người B"],
    ]),
  );
  expect(tree[0].updatedByName).toBe("Người A");
  expect(tree[0].createdBy).toBe("B");
  const before = flatten(tree, "A");
  tree[0].title = "A sửa";
  const changes = changesBetween(before, flatten(tree, "A"));
  expect(changes).toHaveLength(1);
  expect(changes[0].before?.revision).toBe(3);
  expect(changes[0].data.created_by).toBe("B");
  expect(changes[0].data.updated_by).toBeUndefined();
});
