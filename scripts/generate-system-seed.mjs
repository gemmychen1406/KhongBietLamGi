import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = new URL("../", import.meta.url);
// No dependency on seed-N's construction order: UUIDs are based on semantic paths.
function stableId(key) {
  const hex = createHash("sha256")
    .update(`random-activity-web:system-seed:v1:${key}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "8";
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
export async function buildSystemSeed() {
  const source = await readFile(new URL("src/data/seed.ts", root), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const { createSeedDocument } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
  const rows = { activity_nodes: [], activity_variants: [], resources: [] };
  const keys = new Set();
  function identity(key) {
    if (keys.has(key)) throw new Error(`Duplicate seed path: ${key}`);
    keys.add(key);
    return { id: stableId(key), created_by: null, system_seed_key: key };
  }
  function resources(rs, nodeId, variantId, path) {
    rs.forEach((r) =>
      rows.resources.push({
        ...identity(`resource:${JSON.stringify([...path, r.title])}`),
        node_id: nodeId,
        variant_id: variantId,
        title: r.title,
        type: r.type,
        url: r.url || null,
        content: r.content || null,
      }),
    );
  }
  function visit(nodes, parentId, path) {
    for (const n of nodes) {
      const nodePath = [...path, n.title];
      const record = {
        ...identity(`node:${JSON.stringify(nodePath)}`),
        parent_id: parentId,
        title: n.title,
        description: n.description || null,
        kind: n.kind,
        enabled: n.enabled,
      };
      rows.activity_nodes.push(record);
      resources(n.resources, record.id, null, [...nodePath, "@node"]);
      n.variants.forEach((v) => {
        const variant = {
          ...identity(`variant:${JSON.stringify([...nodePath, v.title])}`),
          node_id: record.id,
          title: v.title,
          description: v.description || null,
        };
        rows.activity_variants.push(variant);
        resources(v.resources, record.id, variant.id, [
          ...nodePath,
          "@variant",
          v.title,
        ]);
      });
      visit(n.children, record.id, nodePath);
    }
  }
  const document = createSeedDocument();
  visit(document.nodes, null, []);
  if (
    JSON.stringify(document.nodes.map((n) => n.title)) !==
    JSON.stringify(["Nội trợ", "Nghệ thuật", "Kiến thức"])
  )
    throw new Error("Unexpected root categories");
  return rows;
}
export async function generateSql() {
  const rows = await buildSystemSeed();
  const payload = JSON.stringify(rows);
  if (payload.includes("$seed_payload$"))
    throw new Error("Unsafe SQL payload delimiter");
  const template = await readFile(
    new URL("scripts/templates/system-seed.sql", root),
    "utf8",
  );
  const checksum = createHash("sha256")
    .update(template)
    .update(payload)
    .digest("hex");
  return template
    .replaceAll("__CHECKSUM__", checksum)
    .replace("__PAYLOAD__", JSON.stringify(rows, null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sql = await generateSql();
  const path = new URL("supabase/migrations/002_system_seed.sql", root);
  if (process.argv.includes("--check")) {
    if ((await readFile(path, "utf8")) !== sql)
      throw new Error("Generated SQL is stale: run npm run seed:generate");
    console.log(
      "System seed SQL matches src/data/seed.ts and its reviewed template.",
    );
  } else {
    await writeFile(path, sql);
    const rows = await buildSystemSeed();
    console.log(
      "Generated 002_system_seed.sql:",
      Object.fromEntries(Object.entries(rows).map(([t, rs]) => [t, rs.length])),
    );
  }
}
