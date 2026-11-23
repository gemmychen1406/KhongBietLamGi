import type { ActivityNode, Result } from "../types";
export function eligibleLeaves(
  nodes: ActivityNode[],
  prefix: ActivityNode[] = [],
): ActivityNode[][] {
  return nodes.flatMap((node) =>
    !node.enabled
      ? []
      : node.kind === "activity"
        ? [[...prefix, node]]
        : eligibleLeaves(node.children, [...prefix, node]),
  );
}
export function chooseResult(
  nodes: ActivityNode[],
  options: {
    scopeId?: string;
    previous?: Result;
    fromLevel?: number;
    rng?: () => number;
  } = {},
): Result | null {
  const { scopeId, previous, fromLevel, rng = Math.random } = options;
  let paths = eligibleLeaves(nodes);
  if (scopeId) paths = paths.filter((path) => path[0].id === scopeId);
  if (fromLevel !== undefined) {
    if (!previous || fromLevel < 0 || fromLevel >= previous.path.length)
      return null;
    const prefix = previous.path.slice(0, fromLevel);
    paths = paths.filter((path) =>
      prefix.every((node, i) => path[i]?.id === node.id),
    );
  }
  if (!paths.length) return null;
  if (paths.length > 1 && previous)
    paths = paths.filter((path) => path.at(-1)?.id !== previous.activity.id);
  const pick = <T>(items: T[]): T =>
    items[
      Math.min(items.length - 1, Math.max(0, Math.floor(rng() * items.length)))
    ];
  const path = pick(paths);
  const activity = path[path.length - 1];
  let variants = activity.variants;
  if (variants.length > 1 && previous?.activity.id === activity.id)
    variants = variants.filter((v) => v.id !== previous.variant?.id);
  return structuredClone({
    path: path.map(({ id, title }) => ({ id, title })),
    activity,
    ...(variants.length ? { variant: pick(variants) } : {}),
  });
}
