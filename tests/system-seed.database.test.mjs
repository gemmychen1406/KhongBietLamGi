import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSupabaseDatabase } from "./helpers/supabase-db.mjs";
import { buildSystemSeed } from "../scripts/generate-system-seed.mjs";
const sql = await readFile("supabase/migrations/002_system_seed.sql", "utf8");
const seed = await buildSystemSeed();
const A = "11111111-1111-4111-8111-111111111111",
  ADMIN = "33333333-3333-4333-8333-333333333333";
let db;
before(async () => {
  db = await createSupabaseDatabase();
});
after(async () => {
  await db.close();
});
async function trusted() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub','',false)");
}
async function as(user, query, params = []) {
  await db.exec(`reset role;set role ${user ? "authenticated" : "anon"};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user ?? "",
  ]);
  return db.query(query, params);
}
async function snapshot(database = db) {
  const result = {};
  for (const t of Object.keys(seed))
    result[t] = (
      await database.query(`select * from public.${t} order by id`)
    ).rows;
  return result;
}
test("SQL Editor baseline with no official migration history: seed works without ANY auth user", async () => {
  assert.equal(
    (await db.query("select count(*)::int n from auth.users")).rows[0].n,
    0,
  );
  await db.exec(sql);
  assert.equal(
    (await db.query("select count(*)::int n from auth.users")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.profiles")).rows[0].n,
    0,
  );
  for (const [table, rows] of Object.entries(seed)) {
    const actual = (await db.query(`select * from public.${table}`)).rows;
    assert.equal(actual.length, rows.length);
    for (const expected of rows) {
      const row = actual.find((r) => r.id === expected.id);
      for (const [k, v] of Object.entries(expected))
        assert.deepEqual(row[k], v, `${table}.${expected.title}.${k}`);
    }
  }
  const roots = (
    await as(
      null,
      "select title from public.activity_nodes where parent_id is null",
    )
  ).rows
    .map((r) => r.title)
    .sort();
  assert.deepEqual(roots, ["Nội trợ", "Nghệ thuật", "Kiến thức"].sort());
});
test("Run twice: same rows, IDs, timestamps and one private ledger entry", async () => {
  await trusted();
  const before = await snapshot();
  await db.exec(sql);
  assert.deepEqual(await snapshot(), before);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from random_activity_internal.migration_history where version='002_system_seed'",
      )
    ).rows[0].n,
    1,
  );
});
test("Anonymous snapshot RPC includes every node/variant/resource and performs no writes", async () => {
  const result = (
    await as(null, "select public.get_public_library() as library")
  ).rows[0].library;
  for (const [t, rows] of Object.entries(seed))
    assert.equal(result[t].length, rows.length);
  assert.equal(result.profiles.length, 0);
  await assert.rejects(
    () => as(null, "select public.apply_community_changes('[]')"),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    () => as(null, "select * from random_activity_internal.migration_history"),
    (e) => e.code === "42501",
  );
});
test("Members contribute to system groups/activities, but cannot claim/edit/delete system ownership", async () => {
  await trusted();
  await db.query("insert into auth.users(id) values($1),($2)", [A, ADMIN]);
  await db.query("update public.profiles set role='admin' where id=$1", [
    ADMIN,
  ]);
  const root = seed.activity_nodes.find((n) => n.parent_id === null);
  const activity = seed.activity_nodes.find((n) => n.kind === "activity");
  const memberNode = (
    await as(
      A,
      "insert into public.activity_nodes(parent_id,title,kind) values($1,'Đóng góp thật','activity') returning id,created_by",
      [root.id],
    )
  ).rows[0];
  assert.equal(memberNode.created_by, A);
  await as(
    A,
    "insert into public.activity_variants(node_id,title) values($1,'Variant thành viên')",
    [activity.id],
  );
  await as(
    A,
    "insert into public.resources(node_id,title,type,content) values($1,'Tài nguyên thành viên','text','Nội dung thật')",
    [activity.id],
  );
  assert.equal(
    (
      await as(
        A,
        "update public.activity_nodes set title='Hack' where id=$1 returning id",
        [root.id],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await as(
        A,
        "delete from public.activity_nodes where id=$1 returning id",
        [root.id],
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    () =>
      as(
        A,
        "insert into public.activity_nodes(title,kind,created_by,system_seed_key) values('Fake','group',null,'fake')",
      ),
    (e) => e.code === "42501",
  );
  await assert.rejects(() =>
    as(
      A,
      "insert into public.activity_nodes(title,kind,created_by,system_seed_key) values('Fake','group',$1,'fake')",
      [A],
    ),
  );
  await assert.rejects(() =>
    as(
      A,
      "insert into public.activity_nodes(title,kind,created_by) values('Unowned','group',null)",
    ),
  );
  await assert.rejects(
    () =>
      as(
        A,
        "update public.activity_nodes set created_by=null,system_seed_key=$1 where id=$2",
        ["claim", memberNode.id],
      ),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    () =>
      as(
        ADMIN,
        "update public.activity_nodes set created_by=$1,system_seed_key=null where id=$2",
        [ADMIN, root.id],
      ),
    (e) => e.code === "42501",
  );
  // Other tables cannot be forged either.
  await assert.rejects(
    () =>
      as(
        A,
        "insert into public.activity_variants(node_id,title,created_by,system_seed_key) values($1,'Fake',null,'fake-v')",
        [activity.id],
      ),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    () =>
      as(
        A,
        "insert into public.resources(node_id,title,type,content,created_by,system_seed_key) values($1,'Fake','text','X',null,'fake-r')",
        [activity.id],
      ),
    (e) => e.code === "42501",
  );
});
test("Admin can edit system content through existing atomic RPC; cannot delete member descendants", async () => {
  const node = seed.activity_nodes.find((n) => n.parent_id === null);
  const before = (
    await as(
      ADMIN,
      "select id,parent_id,created_by,system_seed_key,title,description,kind,enabled from public.activity_nodes where id=$1",
      [node.id],
    )
  ).rows[0];
  await as(ADMIN, "select public.apply_community_changes($1)", [
    JSON.stringify([
      {
        table: "activity_nodes",
        op: "update",
        before,
        data: { ...before, title: "Mẫu đã duyệt" },
      },
    ]),
  ]);
  await assert.rejects(
    () => as(ADMIN, "delete from public.activity_nodes where id=$1", [node.id]),
    (e) => e.code === "23503",
  );
});
test("Rerun preserves member contributions, admin edits and deliberate deletion of a system leaf", async () => {
  const leaf = seed.activity_nodes.find(
    (n) =>
      n.kind === "activity" &&
      !seed.activity_variants.some((v) => v.node_id === n.id) &&
      !seed.resources.some((r) => r.node_id === n.id),
  );
  // The first activity received member contributions; choose another unreferenced leaf if necessary.
  const candidate = (
    await as(
      ADMIN,
      `select n.id from public.activity_nodes n where n.system_seed_key is not null and n.kind='activity' and not exists(select 1 from public.activity_variants v where v.node_id=n.id) and not exists(select 1 from public.resources r where r.node_id=n.id) limit 1`,
    )
  ).rows[0].id;
  assert.ok(leaf);
  await as(ADMIN, "delete from public.activity_nodes where id=$1", [candidate]);
  await trusted();
  const before = await snapshot();
  await db.exec(sql);
  assert.deepEqual(await snapshot(), before);
});
test("Existing member data and official migration ledger are untouched on first seed", async () => {
  const other = await createSupabaseDatabase();
  try {
    await other.exec(
      "create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);insert into supabase_migrations.schema_migrations(version,name) values('001','community_manual_verified');",
    );
    await other.query("insert into auth.users(id) values($1)", [A]);
    await other.query(
      "insert into public.activity_nodes(id,created_by,title,kind) values($1,$2,'Nhóm thành viên có sẵn','activity')",
      ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", A],
    );
    await other.query(
      "insert into public.resources(node_id,created_by,title,type,content) values($1,$2,'Không được thay đổi','text','Bản gốc')",
      ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", A],
    );
    const before = await snapshot(other);
    const ledger = (
      await other.query("select * from supabase_migrations.schema_migrations")
    ).rows;
    await other.exec(sql);
    const after = await snapshot(other);
    for (const [t, rows] of Object.entries(before))
      for (const row of rows)
        assert.deepEqual(
          after[t].find((r) => r.id === row.id),
          { ...row, system_seed_key: null },
        );
    assert.deepEqual(
      (await other.query("select * from supabase_migrations.schema_migrations"))
        .rows,
      ledger,
    );
    assert.equal(
      (await other.query("select count(*)::int n from auth.users")).rows[0].n,
      1,
    );
    await other.exec(sql);
    assert.deepEqual(await snapshot(other), after);
  } finally {
    await other.close();
  }
});
test("Wrong migration checksum aborts without changing content", async () => {
  await trusted();
  const before = await snapshot();
  await assert.rejects(() =>
    db.exec(sql.replaceAll(/(?<=checksum <> ')[a-f0-9]{64}/g, "0".repeat(64))),
  );
  await db.exec("rollback");
  assert.deepEqual(await snapshot(), before);
});

test("Interrupted seed rolls back both schema and inserts; existing data remains intact", async () => {
  const other = await createSupabaseDatabase();
  try {
    await other.query("insert into auth.users(id) values($1)", [A]);
    await other.query(
      "insert into public.activity_nodes(created_by,title,kind) values($1,'Bản gốc còn nguyên','group')",
      [A],
    );
    const before = await snapshot(other);
    const bad = sql.replace(
      /"node_id": "[0-9a-f-]{36}"/,
      '"node_id": "00000000-0000-4000-8000-000000000000"',
    );
    await assert.rejects(() => other.exec(bad));
    await other.exec("rollback");
    assert.deepEqual(await snapshot(other), before);
    assert.equal(
      (
        await other.query(
          "select to_regclass('random_activity_internal.migration_history') as ledger",
        )
      ).rows[0].ledger,
      null,
    );
    await other.exec(sql);
    assert.equal(
      (await other.query("select count(*)::int n from public.activity_nodes"))
        .rows[0].n,
      85,
    );
  } finally {
    await other.close();
  }
});
