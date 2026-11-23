import type { ActivityNode } from "../types";
export function findNode(
  nodes: ActivityNode[],
  id: string,
): ActivityNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
}
export function updateNode(
  nodes: ActivityNode[],
  id: string,
  update: (node: ActivityNode) => ActivityNode,
): ActivityNode[] {
  return nodes.map((node) =>
    node.id === id
      ? update(node)
      : { ...node, children: updateNode(node.children, id, update) },
  );
}
export function removeNode(nodes: ActivityNode[], id: string): ActivityNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeNode(node.children, id) }));
}
export function addNode(
  nodes: ActivityNode[],
  parentId: string | null,
  node: ActivityNode,
): ActivityNode[] {
  if (!parentId) return [...nodes, node];
  const parent = findNode(nodes, parentId);
  if (!parent || parent.kind !== "group")
    throw new Error("Chỉ có thể thêm vào nhóm.");
  return updateNode(nodes, parentId, (p) => ({
    ...p,
    children: [...p.children, node],
  }));
}
export function countNodes(nodes: ActivityNode[]): {
  groups: number;
  activities: number;
} {
  let groups = 0,
    activities = 0;
  for (const node of nodes) {
    if (node.kind === "group") groups++;
    else activities++;
    const child = countNodes(node.children);
    groups += child.groups;
    activities += child.activities;
  }
  return { groups, activities };
}
export function matchesTree(node: ActivityNode, query: string): boolean {
  return (
    node.title
      .toLocaleLowerCase("vi")
      .includes(query.toLocaleLowerCase("vi")) ||
    node.children.some((child) => matchesTree(child, query))
  );
}
