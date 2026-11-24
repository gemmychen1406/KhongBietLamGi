// Real PostgreSQL engine (PGlite), with minimal Supabase auth/storage schema stubs.
// HTTP Auth, real Storage MIME/size enforcement and cross-device delivery need a Supabase project.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
const db = new PGlite();
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  ADMIN = "33333333-3333-4333-8333-333333333333";
const ROOT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  NODE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  RESOURCE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
  `);
  await db.exec(
    await readFile("supabase/migrations/001_community.sql", "utf8"),
  );
  await db.query(
    `insert into auth.users(id,raw_user_meta_data) values ($1,'{"display_name":"A","role":"admin"}'),($2,'{"display_name":"B"}'),($3,'{}')`,
    [A, B, ADMIN],
  );
  await db.query(`update public.profiles set role='admin' where id=$1`, [
    ADMIN,
  ]);
});
after(async () => {
  await db.close();
});
async function as(user, sql, params = []) {
  await db.exec(`reset role; set role ${user ? "authenticated" : "anon"};`);
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
    user ?? "",
  ]);
  return db.query(sql, params);
}
async function rejectsCode(fn, code) {
  await assert.rejects(fn, (e) => e.code === code);
}
test("1. Guest reads public content and cannot INSERT or RPC write", async () => {
  assert.equal(
    (await as(null, "select * from public.activity_nodes")).rows.length,
    0,
  );
  await rejectsCode(
    () =>
      as(
        null,
        `insert into public.activity_nodes(title,kind,created_by) values('X','activity',$1)`,
        [A],
      ),
    "42501",
  );
  await rejectsCode(
    () => as(null, `select public.apply_community_changes('[]')`),
    "42501",
  );
});
test("2. A creates group/activity; B and guest read them", async () => {
  await as(
    A,
    `insert into public.activity_nodes(id,title,kind) values($1,'Nhóm A','group')`,
    [ROOT],
  );
  await as(
    A,
    `insert into public.activity_nodes(id,parent_id,title,kind) values($1,$2,'Hoạt động A','activity')`,
    [NODE, ROOT],
  );
  assert.equal(
    (await as(B, "select * from public.activity_nodes")).rows.length,
    2,
  );
  assert.equal(
    (await as(null, "select * from public.activity_nodes")).rows.length,
    2,
  );
});
test("3. B adds own resource and variant to A activity", async () => {
  await as(
    B,
    `insert into public.resources(id,node_id,title,type,content) values($1,$2,'Tài nguyên B','text','Nội dung B')`,
    [RESOURCE, NODE],
  );
  const v = await as(
    B,
    `insert into public.activity_variants(node_id,title) values($1,'Biến thể B') returning created_by`,
    [NODE],
  );
  assert.equal(v.rows[0].created_by, B);
  assert.equal(
    (await as(A, "select created_by from public.resources")).rows[0].created_by,
    B,
  );
});
test("4. B cannot update/delete A node, forge owner or relocate content", async () => {
  assert.equal(
    (
      await as(
        B,
        `update public.activity_nodes set title='Hacked' where id=$1 returning id`,
        [NODE],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await as(
        B,
        `delete from public.activity_nodes where id=$1 returning id`,
        [NODE],
      )
    ).rows.length,
    0,
  );
  await rejectsCode(
    () =>
      as(
        B,
        `insert into public.activity_nodes(title,kind,created_by) values('Forged','activity',$1)`,
        [A],
      ),
    "42501",
  );
  await rejectsCode(
    () =>
      as(B, `update public.resources set created_by=$1 where id=$2`, [
        A,
        RESOURCE,
      ]),
    "42501",
  );
  await assert.rejects(() =>
    as(A, `update public.activity_nodes set parent_id=null where id=$1`, [
      NODE,
    ]),
  );
});
test("5. A cannot delete ancestors with dependent contributions", async () => {
  await rejectsCode(
    () => as(A, `delete from public.activity_nodes where id=$1`, [ROOT]),
    "23503",
  );
  await rejectsCode(
    () => as(A, `delete from public.activity_nodes where id=$1`, [NODE]),
    "23503",
  );
  assert.equal((await as(B, "select id from public.resources")).rows.length, 1);
});
test("6. Member cannot self-promote through profiles, metadata or RPC", async () => {
  assert.equal(
    (await as(A, "select public.is_admin() as admin")).rows[0].admin,
    false,
  );
  await rejectsCode(
    () => as(A, `update public.profiles set role='admin' where id=$1`, [A]),
    "42501",
  );
  await rejectsCode(
    () =>
      as(
        A,
        `insert into public.profiles(id,display_name,role) values($1,'A','admin')`,
        [A],
      ),
    "42501",
  );
  await assert.rejects(() =>
    as(A, `select public.apply_community_changes($1)`, [
      JSON.stringify([
        { table: "profiles", op: "update", data: { id: A, role: "admin" } },
      ]),
    ]),
  );
});
test("Role RPC rejects member promotion and protects the last admin", async () => {
  await rejectsCode(
    () => as(A, "select public.set_member_role($1,$2)", [A, "admin"]),
    "42501",
  );
  await assert.rejects(() =>
    as(ADMIN, "select public.set_member_role($1,$2)", [ADMIN, "member"]),
  );
  await as(ADMIN, "select public.set_member_role($1,$2)", [B, "admin"]);
  assert.equal(
    (await as(B, "select public.is_admin() as admin")).rows[0].admin,
    true,
  );
  await as(ADMIN, "select public.set_member_role($1,$2)", [B, "member"]);
});
test("7. Admin edits A/B content; dependencies still RESTRICT deletion", async () => {
  assert.equal(
    (await as(ADMIN, "select public.is_admin() as admin")).rows[0].admin,
    true,
  );
  assert.equal(
    (
      await as(
        ADMIN,
        `update public.activity_nodes set title='Đã duyệt' where id=$1 returning id`,
        [NODE],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await as(
        ADMIN,
        `update public.resources set title='Đã duyệt tài nguyên' where id=$1 returning id`,
        [RESOURCE],
      )
    ).rows.length,
    1,
  );
  await rejectsCode(
    () => as(ADMIN, `delete from public.activity_nodes where id=$1`, [ROOT]),
    "23503",
  );
  await as(ADMIN, `delete from public.resources where id=$1`, [RESOURCE]);
});
test("8. New guest/member sessions see committed library independently", async () => {
  assert.equal(
    (
      await as(null, `select title from public.activity_nodes where id=$1`, [
        NODE,
      ])
    ).rows[0].title,
    "Đã duyệt",
  );
  assert.equal(
    (await as(B, `select title from public.activity_nodes where id=$1`, [NODE]))
      .rows[0].title,
    "Đã duyệt",
  );
});
test("Atomic RPC rolls back earlier writes when a later operation is denied", async () => {
  const own = {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    created_by: B,
    title: "Rollback",
    kind: "activity",
    enabled: true,
    parent_id: null,
    description: null,
  };
  const before = (
    await as(
      B,
      "select id,parent_id,created_by,title,kind,enabled,description from public.activity_nodes where id=$1",
      [NODE],
    )
  ).rows[0];
  await assert.rejects(() =>
    as(B, "select public.apply_community_changes($1)", [
      JSON.stringify([
        { table: "activity_nodes", op: "insert", data: own },
        {
          table: "activity_nodes",
          op: "update",
          before,
          data: { ...before, title: "Unauthorized" },
        },
      ]),
    ]),
  );
  assert.equal(
    (await as(B, "select id from public.activity_nodes where id=$1", [own.id]))
      .rows.length,
    0,
  );
});
test("RPC saves legitimate independent contributions and detects stale editors", async () => {
  const before = (
    await as(
      A,
      "select id,parent_id,created_by,title,kind,enabled,description from public.activity_nodes where id=$1",
      [NODE],
    )
  ).rows[0];
  const change = {
    table: "activity_nodes",
    op: "update",
    before,
    data: { ...before, title: "Mới" },
  };
  await as(A, "select public.apply_community_changes($1)", [
    JSON.stringify([change]),
  ]);
  await rejectsCode(
    () =>
      as(A, "select public.apply_community_changes($1)", [
        JSON.stringify([change]),
      ]),
    "40001",
  );
});
test("Constraints reject bad parent, variant target, URL and empty text", async () => {
  await assert.rejects(() =>
    as(
      B,
      `insert into public.activity_nodes(title,kind,parent_id) values('Child','group',$1)`,
      [NODE],
    ),
  );
  await assert.rejects(() =>
    as(
      B,
      `insert into public.activity_variants(title,node_id) values('Bad',$1)`,
      [ROOT],
    ),
  );
  await rejectsCode(
    () =>
      as(
        B,
        `insert into public.resources(title,type,url,node_id) values('Bad','link','javascript:alert(1)',$1)`,
        [NODE],
      ),
    "23514",
  );
  await rejectsCode(
    () =>
      as(
        B,
        `insert into public.resources(title,type,node_id) values('Bad','text',$1)`,
        [NODE],
      ),
    "23514",
  );
});
test("Storage policies: own folder upload only, owner/admin delete, no overwrite", async () => {
  await rejectsCode(
    () =>
      as(
        null,
        `insert into storage.objects(bucket_id,name,owner_id) values('activity-images',$1,$2)`,
        [`${A}/x`, A],
      ),
    "42501",
  );
  await rejectsCode(
    () =>
      as(
        B,
        `insert into storage.objects(bucket_id,name,owner_id) values('activity-images',$1,$2)`,
        [`${A}/x`, B],
      ),
    "42501",
  );
  await as(
    B,
    `insert into storage.objects(bucket_id,name,owner_id) values('activity-images',$1,$2)`,
    [`${B}/x`, B],
  );
  assert.equal(
    (await as(A, `delete from storage.objects returning id`)).rows.length,
    0,
  );
  assert.equal(
    (await as(B, `update storage.objects set name='changed' returning id`)).rows
      .length,
    0,
  );
  assert.equal(
    (await as(null, "select * from storage.objects")).rows.length,
    1,
  );
  assert.equal(
    (await as(ADMIN, "delete from storage.objects returning id")).rows.length,
    1,
  );
});
