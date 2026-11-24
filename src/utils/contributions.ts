import type { ActivityNode, Resource, Variant } from "../types";
export interface OwnedNode {
  node: ActivityNode;
  path: string[];
}
export interface OwnedVariant {
  variant: Variant;
  node: ActivityNode;
  path: string[];
}
export interface OwnedResource {
  resource: Resource;
  node: ActivityNode;
  path: string[];
  variant?: Variant;
}
export function collectContributions(
  nodes: ActivityNode[],
  userId: string | null,
) {
  const ownedNodes: OwnedNode[] = [];
  const variants: OwnedVariant[] = [];
  const resources: OwnedResource[] = [];
  if (!userId) return { nodes: ownedNodes, variants, resources };
  function visit(ns: ActivityNode[], prefix: string[]) {
    for (const node of ns) {
      const path = [...prefix, node.title];
      if (node.createdBy === userId && !node.systemSeedKey)
        ownedNodes.push({ node, path });
      for (const resource of node.resources)
        if (resource.createdBy === userId && !resource.systemSeedKey)
          resources.push({ resource, node, path });
      for (const variant of node.variants) {
        if (variant.createdBy === userId && !variant.systemSeedKey)
          variants.push({ variant, node, path });
        for (const resource of variant.resources)
          if (resource.createdBy === userId && !resource.systemSeedKey)
            resources.push({
              resource,
              node,
              variant,
              path: [...path, variant.title],
            });
      }
      visit(node.children, path);
    }
  }
  visit(nodes, []);
  return { nodes: ownedNodes, variants, resources };
}
export function contributionDate(date?: string) {
  return date && !Number.isNaN(Date.parse(date))
    ? new Date(date).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;
}
