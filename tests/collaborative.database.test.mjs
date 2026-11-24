import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSupabaseDatabase } from "./helpers/supabase-db.mjs";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  ADMIN = "33333333-3333-4333-8333-333333333333";
const NODE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  VARIANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  RESOURCE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const migration = await readFile(
  "supabase/migrations/003_collaborative_editing.sql",
  "utf8",
);
let db;
let systemRoot;
let original;
before(async () => {
  db = await createSupabaseDatabase();
  await db.exec(
    await readFile("supabase/migrations/002_system_seed.sql", "utf8"),
  );
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    A,
    B,
    ADMIN,
  ]);
  await db.query("update public.profiles set role='admin' where id=$1", [
    ADMIN,
  ]);
  systemRoot = (
    await db.query(
      "select id from public.activity_nodes where parent_id is null limit 1",
    )
  ).rows[0].id;
  await db.query(
    "insert into public.activity_nodes(id,created_by,title,kind) values($1,$2,'Hoạt động của B','activity')",
    [NODE, B],
  );
  await db.query(
    "insert into public.activity_variants(id,node_id,created_by,title) values($1,$2,$3,'Biến thể B')",
    [VARIANT, NODE, B],
  );
  await db.query(
    "insert into public.resources(id,node_id,created_by,title,type,content) values($1,$2,$3,'Tài nguyên B','text','Bản gốc')",
    [RESOURCE, NODE, B],
  );
  original = (await db.query("select * from public.activity_nodes order by id"))
    .rows;
  await db.exec(migration);
});
after(async () => {
  await db.close();
});
async function as(uid, sql, args = []) {
  await db.exec(`reset role;set role ${uid ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    uid ?? "",
  ]);
  return db.query(sql, args);
}
async function trusted() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub','',false)");
}
async function row(table, id, uid = A) {
  const result = (
    await as(uid, `select * from public.${table} where id=$1`, [id])
  ).rows[0];
  delete result.created_at;
  delete result.updated_at;
  delete result.updated_by;
  return result;
}
async function apply(uid, changes) {
  return as(uid, "select public.apply_community_changes($1)", [
    JSON.stringify(changes),
  ]);
}
test("Migration preserves original content/creators and enables RLS on all four tables", async () => {
  await trusted();
  const actual = (
    await db.query("select * from public.activity_nodes order by id")
  ).rows;
  for (const old of original) {
    const now = actual.find((r) => r.id === old.id);
    for (const [key, value] of Object.entries(old))
      assert.deepEqual(now[key], value);
    assert.equal(now.revision, 0);
    assert.equal(now.updated_by, null);
    assert.equal(now.updated_at, null);
  }
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from pg_class where oid in ('public.profiles'::regclass,'public.activity_nodes'::regclass,'public.activity_variants'::regclass,'public.resources'::regclass) and relrowsecurity",
      )
    ).rows[0].n,
    4,
  );
});
test("Guest reads complete library but cannot insert, edit, delete or call writes", async () => {
  assert.ok(
    (await as(null, "select public.get_public_library() as library")).rows[0]
      .library.activity_nodes.length > 80,
  );
  await assert.rejects(
    () =>
      as(
        null,
        "insert into public.activity_nodes(title,kind,created_by) values('Bad','group',$1)",
        [A],
      ),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    () =>
      as(null, "update public.activity_nodes set title='Bad' where id=$1", [
        NODE,
      ]),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    () => as(null, "delete from public.resources where id=$1", [RESOURCE]),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    () => apply(null, []),
    (e) => e.code === "42501",
  );
});
test("Member adds own group/activity to system group and own variant/resource to another creator", async () => {
  const group = (
    await as(
      A,
      "insert into public.activity_nodes(parent_id,title,kind) values($1,'Nhóm con A','group') returning *",
      [systemRoot],
    )
  ).rows[0];
  const activity = (
    await as(
      A,
      "insert into public.activity_nodes(parent_id,title,kind) values($1,'Hoạt động A','activity') returning *",
      [group.id],
    )
  ).rows[0];
  assert.equal(activity.created_by, A);
  assert.equal(activity.updated_by, A);
  assert.equal(activity.revision, 0);
  await as(
    A,
    "insert into public.activity_variants(node_id,title) values($1,'Variant A trên B')",
    [NODE],
  );
  await as(
    A,
    "insert into public.resources(node_id,title,type,content) values($1,'Resource A trên B','text','Đóng góp A')",
    [NODE],
  );
  await assert.rejects(
    () =>
      as(
        A,
        "insert into public.resources(node_id,created_by,title,type,content) values($1,$2,'Fake','text','X')",
        [NODE, B],
      ),
    (e) => e.code === "42501",
  );
});
test("A edits B node, variant, resource and system content while preserving original ownership", async () => {
  for (const [table, id] of [
    ["activity_nodes", NODE],
    ["activity_variants", VARIANT],
    ["resources", RESOURCE],
    ["activity_nodes", systemRoot],
  ]) {
    const before = await row(table, id);
    await as(
      A,
      `update public.${table} set title=title||' · A sửa' where id=$1`,
      [id],
    );
    const after = await row(table, id, B);
    assert.equal(after.created_by, before.created_by);
    assert.equal(after.system_seed_key, before.system_seed_key);
    assert.equal(after.revision, before.revision + 1);
    const audit = (
      await as(
        B,
        `select updated_by,updated_at from public.${table} where id=$1`,
        [id],
      )
    ).rows[0];
    assert.equal(audit.updated_by, A);
    assert.ok(audit.updated_at);
  }
});
test("A cannot delete B/system rows; deletion is distinct from editing", async () => {
  for (const [table, id] of [
    ["activity_nodes", NODE],
    ["activity_variants", VARIANT],
    ["resources", RESOURCE],
    ["activity_nodes", systemRoot],
  ]) {
    assert.equal(
      (
        await as(A, `delete from public.${table} where id=$1 returning id`, [
          id,
        ])
      ).rows.length,
      0,
    );
    const before = await row(table, id);
    await assert.rejects(
      () => apply(A, [{ table, op: "delete", before, data: before }]),
      (e) => e.code === "42501",
    );
  }
});
test("Owner, ID, system key, created_at, parent and kind remain immutable for Members and Admins", async () => {
  for (const uid of [A, ADMIN]) {
    await assert.rejects(
      () =>
        as(uid, "update public.activity_nodes set created_by=$1 where id=$2", [
          A,
          NODE,
        ]),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      () =>
        as(
          uid,
          "update public.activity_nodes set system_seed_key=$1 where id=$2",
          ["claim", NODE],
        ),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      () =>
        as(
          uid,
          "update public.activity_nodes set created_at=now() where id=$1",
          [NODE],
        ),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      () =>
        as(
          uid,
          "update public.activity_nodes set id=gen_random_uuid() where id=$1",
          [NODE],
        ),
      (e) => e.code === "42501",
    );
    await assert.rejects(() =>
      as(uid, "update public.activity_nodes set parent_id=$1 where id=$2", [
        systemRoot,
        NODE,
      ]),
    );
  }
  const before = await row("activity_nodes", NODE);
  await assert.rejects(
    () =>
      apply(A, [
        {
          table: "activity_nodes",
          op: "update",
          before,
          data: { ...before, created_by: A },
        },
      ]),
    (e) => e.code === "42501",
  );
});
test("Audit fields are server-derived; a Member cannot forge the most recent editor or revision", async () => {
  const before = await row("activity_nodes", NODE);
  await as(
    A,
    "update public.activity_nodes set description='A chỉnh sửa',updated_by=$1,updated_at='2000-01-01',revision=999 where id=$2",
    [ADMIN, NODE],
  );
  const actual = (
    await as(A, "select * from public.activity_nodes where id=$1", [NODE])
  ).rows[0];
  assert.equal(actual.updated_by, A);
  assert.equal(actual.revision, before.revision + 1);
  assert.ok(new Date(actual.updated_at).getFullYear() > 2000);
});
test("Atomic RPC allows cross-owner editing and rejects stale editors including ABA changes", async () => {
  const old = await row("resources", RESOURCE);
  const change = {
    table: "resources",
    op: "update",
    before: old,
    data: { ...old, content: "A cập nhật qua RPC" },
  };
  await apply(A, [change]);
  assert.equal(
    (await row("resources", RESOURCE, B)).content,
    "A cập nhật qua RPC",
  );
  await assert.rejects(
    () => apply(B, [change]),
    (e) => e.code === "40001",
  );
  const aba = await row("resources", RESOURCE);
  await as(B, "update public.resources set content='Tạm thời' where id=$1", [
    RESOURCE,
  ]);
  await as(B, "update public.resources set content=$1 where id=$2", [
    aba.content,
    RESOURCE,
  ]);
  await assert.rejects(
    () =>
      apply(A, [
        {
          table: "resources",
          op: "update",
          before: aba,
          data: { ...aba, title: "Stale" },
        },
      ]),
    (e) => e.code === "40001",
  );
  const missing = { ...(await row("resources", RESOURCE)) };
  delete missing.revision;
  await assert.rejects(
    () =>
      apply(A, [
        {
          table: "resources",
          op: "update",
          before: missing,
          data: { ...missing, title: "Blind" },
        },
      ]),
    (e) => e.code === "40001",
  );
});
test("Unauthorized delete rolls back earlier edits in the same editor save", async () => {
  const node = await row("activity_nodes", NODE);
  const resource = await row("resources", RESOURCE);
  await assert.rejects(
    () =>
      apply(A, [
        {
          table: "activity_nodes",
          op: "update",
          before: node,
          data: { ...node, title: "Không được lưu dở dang" },
        },
        { table: "resources", op: "delete", before: resource, data: resource },
      ]),
    (e) => e.code === "42501",
  );
  assert.deepEqual(await row("activity_nodes", NODE), node);
});
test("Member cannot promote self; Admin still manages roles, edits and deletes subject to dependencies", async () => {
  await assert.rejects(
    () => as(A, "update public.profiles set role='admin' where id=$1", [A]),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    () => as(A, "select public.set_member_role($1,$2)", [A, "admin"]),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    () => as(ADMIN, "delete from public.activity_nodes where id=$1", [NODE]),
    (e) => e.code === "23503",
  );
  const own = (
    await as(
      A,
      "insert into public.resources(node_id,title,type,content) values($1,'Xóa được','text','A') returning id",
      [NODE],
    )
  ).rows[0].id;
  assert.equal(
    (
      await as(A, "delete from public.resources where id=$1 returning id", [
        own,
      ])
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await as(ADMIN, "delete from public.resources where id=$1 returning id", [
        RESOURCE,
      ])
    ).rows.length,
    1,
  );
});
test("New independent session sees edits and migration rerun does not change content/audit metadata", async () => {
  const result = (
    await as(null, "select public.get_public_library() as library")
  ).rows[0].library;
  assert.ok(
    result.activity_nodes.find((n) => n.id === NODE).description ===
      "A chỉnh sửa",
  );
  await trusted();
  const before = (
    await db.query("select * from public.activity_nodes order by id")
  ).rows;
  await db.exec(migration);
  assert.deepEqual(
    (await db.query("select * from public.activity_nodes order by id")).rows,
    before,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from random_activity_internal.migration_history where version='003_collaborative_editing'",
      )
    ).rows[0].n,
    1,
  );
});

test("Rerunning unchanged 002 after 003 preserves collaborative rights, audit and revision protection", async () => {
  await trusted();
  const before = (
    await db.query("select revision from public.activity_nodes where id=$1", [
      NODE,
    ])
  ).rows[0].revision;
  await db.exec(
    await readFile("supabase/migrations/002_system_seed.sql", "utf8"),
  );
  await as(
    A,
    "update public.activity_nodes set description='Sau khi chạy lại 002' where id=$1",
    [NODE],
  );
  const actual = (
    await as(
      B,
      "select created_by,updated_by,revision from public.activity_nodes where id=$1",
      [NODE],
    )
  ).rows[0];
  assert.equal(actual.created_by, B);
  assert.equal(actual.updated_by, A);
  assert.equal(actual.revision, before + 1);
  assert.equal(
    (
      await as(
        A,
        "delete from public.activity_nodes where id=$1 returning id",
        [NODE],
      )
    ).rows.length,
    0,
  );
});
