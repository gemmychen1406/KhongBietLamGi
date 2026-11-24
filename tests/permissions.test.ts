import { expect, it } from "vitest";
import { canEdit, canDelete, canContribute } from "../src/services/permissions";
import { supportsSharedEditing } from "../src/services/community";
import { createSeedDocument } from "../src/data/seed";
const member = { userId: "A", admin: false, community: true };
it("Member edits others and system content but only deletes their own", () => {
  for (const item of [
    { createdBy: "B" },
    { systemSeedKey: "seed:1" },
    { createdBy: "Admin" },
  ]) {
    expect(canEdit(member, item)).toBe(true);
    expect(canDelete(member, item)).toBe(false);
  }
  expect(canDelete(member, { createdBy: "A" })).toBe(true);
  expect(canEdit({ ...member, userId: null }, { createdBy: "A" })).toBe(false);
  expect(canDelete({ ...member, admin: true }, { systemSeedKey: "seed" })).toBe(
    true,
  );
  expect(canContribute({ ...member, readOnly: true })).toBe(false);
  expect(canEdit({ ...member, readOnly: true }, {})).toBe(false);
});
it("missing revision or a local sample never advertises readiness for shared editing", () => {
  const nodes = createSeedDocument().nodes;
  expect(supportsSharedEditing(nodes)).toBe(false);
  const stamp = (ns: typeof nodes) =>
    ns.forEach((n) => {
      n.revision = 0;
      n.resources.forEach((r) => (r.revision = 0));
      n.variants.forEach((v) => {
        v.revision = 0;
        v.resources.forEach((r) => (r.revision = 0));
      });
      stamp(n.children);
    });
  stamp(nodes);
  expect(supportsSharedEditing(nodes)).toBe(true);
  nodes[0].revision = undefined;
  expect(supportsSharedEditing(nodes)).toBe(false);
});
