-- Generated from src/data/seed.ts. Run this WHOLE file once in SQL Editor as postgres.
-- Existing 001 tables are inspected, never recreated. No auth.users records are created.
-- Re-running this file is safe; member data and later edits/deletions of system data are preserved.
begin;
select pg_advisory_xact_lock(72819402);

do $preflight$
declare item record; remote_versions text; t text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select string_agg(version::text, '', '' order by version::text) from supabase_migrations.schema_migrations' into remote_versions;
    raise notice 'Supabase migration history: %', coalesce(remote_versions, '(empty)');
  else
    raise notice 'No Supabase migration ledger: checking actual schema (001 may have been run manually).';
  end if;
  for item in select * from (values
    ('profiles','id','uuid'),('profiles','display_name','text'),('profiles','role','text'),
    ('activity_nodes','id','uuid'),('activity_nodes','parent_id','uuid'),('activity_nodes','created_by','uuid'),('activity_nodes','title','text'),('activity_nodes','description','text'),('activity_nodes','kind','text'),('activity_nodes','enabled','boolean'),('activity_nodes','created_at','timestamp with time zone'),
    ('activity_variants','id','uuid'),('activity_variants','node_id','uuid'),('activity_variants','created_by','uuid'),('activity_variants','title','text'),('activity_variants','description','text'),('activity_variants','created_at','timestamp with time zone'),
    ('resources','id','uuid'),('resources','node_id','uuid'),('resources','variant_id','uuid'),('resources','created_by','uuid'),('resources','title','text'),('resources','type','text'),('resources','url','text'),('resources','content','text'),('resources','created_at','timestamp with time zone')
  ) as expected(tbl,col,typ) loop
    if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=item.tbl and column_name=item.col and data_type=item.typ) then
      raise exception 'Schema differs from 001: missing/wrong public.%.%. Nothing was changed. Do not rerun 001 on existing tables.',item.tbl,item.col;
    end if;
  end loop;
  if to_regprocedure('public.is_admin()') is null or to_regprocedure('public.apply_community_changes(jsonb)') is null then
    raise exception 'Community authorization functions are missing; stopping without changing data.';
  end if;
  foreach t in array array['activity_nodes','activity_variants','resources'] loop
    if not exists (
      select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
      where c.contype='f' and c.conrelid=to_regclass('public.'||t) and c.confrelid=to_regclass('auth.users') and a.attname='created_by'
    ) then raise exception 'Missing auth.users FK on %.created_by; stopping safely.',t; end if;
  end loop;
end;
$preflight$;

-- A private application ledger also covers SQL Editor runs (which are not recorded by the CLI).
create schema if not exists random_activity_internal;
revoke all on schema random_activity_internal from public, anon, authenticated;
create table if not exists random_activity_internal.migration_history (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
alter table random_activity_internal.migration_history enable row level security;
revoke all on random_activity_internal.migration_history from public, anon, authenticated;
do $history$
begin
  if exists(select 1 from random_activity_internal.migration_history where version='002_system_seed' and checksum <> '69bea1074692d1566e861744a93732f663c892d36db5904887306e641a389cc5') then
    raise exception '002_system_seed was already applied with a different checksum. Use a new reviewed migration; no data was changed.';
  end if;
end;
$history$;

-- Two explicit ownership classes. NULL is allowed ONLY for registered system seed rows.
-- All old/member rows keep their original non-null auth.users FK and ownership.
do $ownership$
declare t text;
begin
  foreach t in array array['activity_nodes','activity_variants','resources'] loop
    execute format('alter table public.%I add column if not exists system_seed_key text',t);
    execute format('alter table public.%I alter column created_by drop not null',t);
    if not exists(select 1 from pg_constraint where conrelid=to_regclass('public.'||t) and conname='content_owner_class') then
      execute format('alter table public.%I add constraint content_owner_class check ((created_by is not null and system_seed_key is null) or (created_by is null and system_seed_key is not null and length(btrim(system_seed_key)) between 1 and 2000))',t);
    end if;
    execute format('create unique index if not exists %I on public.%I(system_seed_key)',t||'_system_seed_key_idx',t);
    execute format('alter table public.%I enable row level security',t);
    execute format('grant select on public.%I to anon, authenticated',t);
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='system_seed_public_read') then
      execute format('create policy system_seed_public_read on public.%I for select to anon,authenticated using (true)',t);
    end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='system_seed_insert_guard') then
      execute format('create policy system_seed_insert_guard on public.%I as restrictive for insert to authenticated with check (created_by=(select auth.uid()) and system_seed_key is null)',t);
    end if;
  end loop;
end;
$ownership$;
-- Names are public, but client role changes remain forbidden by the original grants/RLS.
alter table public.profiles enable row level security;
grant select on public.profiles to anon,authenticated;
do $profile_read$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='system_seed_public_read') then
    create policy system_seed_public_read on public.profiles for select to anon,authenticated using (true);
  end if;
end;
$profile_read$;

create or replace function public.guard_content() returns trigger
language plpgsql set search_path = '' as $guard$
declare target_kind text;
begin
  if TG_OP='UPDATE' then
    if new.id is distinct from old.id or new.created_by is distinct from old.created_by
      or new.system_seed_key is distinct from old.system_seed_key or new.created_at is distinct from old.created_at then
      raise exception 'Không được đổi ID, quyền sở hữu hệ thống, người tạo hoặc thời điểm tạo' using errcode='42501';
    end if;
    if TG_TABLE_NAME='activity_nodes' then
      if new.parent_id is distinct from old.parent_id or new.kind is distinct from old.kind then raise exception 'Không được di chuyển hoặc đổi loại nhánh'; end if;
    elsif TG_TABLE_NAME='activity_variants' then
      if new.node_id is distinct from old.node_id then raise exception 'Không được di chuyển biến thể'; end if;
    else
      if new.node_id is distinct from old.node_id or new.variant_id is distinct from old.variant_id then raise exception 'Không được di chuyển tài nguyên'; end if;
    end if;
  end if;
  if TG_TABLE_NAME='activity_nodes' then
    if new.parent_id is not null then
      select kind into target_kind from public.activity_nodes where id=new.parent_id;
      if target_kind is distinct from 'group' then raise exception 'Cha phải là nhóm công khai tồn tại'; end if;
    end if;
  else
    select kind into target_kind from public.activity_nodes where id=new.node_id;
    if target_kind is distinct from 'activity' then raise exception 'Biến thể/tài nguyên phải thuộc hoạt động'; end if;
  end if;
  return new;
end;
$guard$;
revoke all on function public.guard_content() from public;
do $triggers$
declare t text;
begin
  foreach t in array array['activity_nodes','activity_variants','resources'] loop
    if not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||t) and tgname='guard_'||t and not tgisinternal) then
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.guard_content()','guard_'||t,t);
    end if;
  end loop;
end;
$triggers$;

-- A single statement/snapshot prevents partially loaded trees during concurrent contributions.
-- SECURITY INVOKER: reads still follow the caller's RLS. No writes, no user metadata, no secrets.
create or replace function public.get_public_library() returns jsonb
language sql stable security invoker set search_path = '' as $library$
  select jsonb_build_object(
    'activity_nodes',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at,n.id) from public.activity_nodes n),'[]'::jsonb),
    'activity_variants',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at,v.id) from public.activity_variants v),'[]'::jsonb),
    'resources',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from public.resources r),'[]'::jsonb),
    'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name) order by p.id) from public.profiles p),'[]'::jsonb)
  );
$library$;
revoke all on function public.get_public_library() from public;
grant execute on function public.get_public_library() to anon,authenticated;

-- All seed rows are generated below from the REAL seed.ts, using deterministic UUIDs and keys.
-- There is no anonymous/public seeding RPC. Only a trusted SQL session runs this block.
do $seed$
declare payload jsonb := $seed_payload${
  "activity_nodes": [
    {
      "id": "cac43533-5b8f-80ed-9c51-888ce1ba844b",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\"]",
      "parent_id": null,
      "title": "Nội trợ",
      "description": "Một góc nhỏ gọn gàng, một ngày nhẹ nhàng.",
      "kind": "group",
      "enabled": true
    },
    {
      "id": "ea4c71f5-0bef-8da2-b542-e0b6f3587799",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Dọn dẹp\"]",
      "parent_id": "cac43533-5b8f-80ed-9c51-888ce1ba844b",
      "title": "Dọn dẹp",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "fda17831-f888-8226-b844-8ab755da6808",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Dọn dẹp\",\"Tủ quần áo\"]",
      "parent_id": "ea4c71f5-0bef-8da2-b542-e0b6f3587799",
      "title": "Tủ quần áo",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "2d38feb6-4b1c-8dd0-9a10-6e17ddf1449c",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Dọn dẹp\",\"Tủ quần áo\",\"Ngăn kéo\"]",
      "parent_id": "fda17831-f888-8226-b844-8ab755da6808",
      "title": "Ngăn kéo",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "d3a99157-2dbd-8263-81d2-cd4060828c7b",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Dọn dẹp\",\"Tủ quần áo\",\"Ngăn kéo\",\"Sắp xếp một ngăn tủ\"]",
      "parent_id": "2d38feb6-4b1c-8dd0-9a10-6e17ddf1449c",
      "title": "Sắp xếp một ngăn tủ",
      "description": "Chọn đúng một ngăn. Lấy đồ ra, lau sạch rồi chia thành ba nhóm: giữ lại, chuyển chỗ, cho đi. Chỉ cần 10 phút.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "9e958f06-6c67-850d-8f35-896db6d825c9",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Dọn dẹp\",\"Tủ quần áo\",\"Ngăn kéo\",\"Gấp và xếp quần áo\"]",
      "parent_id": "2d38feb6-4b1c-8dd0-9a10-6e17ddf1449c",
      "title": "Gấp và xếp quần áo",
      "description": "Gấp 5 món đồ đang để ngoài. Xếp đứng để dễ nhìn thấy từng món.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "276239e6-3df0-8db8-ac65-d5433a579d52",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Dọn dẹp\",\"Tủ quần áo\",\"Dọn tủ\"]",
      "parent_id": "fda17831-f888-8226-b844-8ab755da6808",
      "title": "Dọn tủ",
      "description": "Chọn 3 món không còn dùng, để riêng và cân nhắc tặng hoặc tái sử dụng.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "c77b7323-62b7-8c9e-8c1c-24c9766ded99",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Dọn dẹp\",\"Quét nhà\"]",
      "parent_id": "ea4c71f5-0bef-8da2-b542-e0b6f3587799",
      "title": "Quét nhà",
      "description": "Bắt đầu từ một căn phòng, quét từ góc xa ra cửa. Dành 10 phút làm gọn sàn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "694a1cb1-5026-8b34-bb6f-463cb700243f",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Dọn dẹp\",\"Lau nhà\"]",
      "parent_id": "ea4c71f5-0bef-8da2-b542-e0b6f3587799",
      "title": "Lau nhà",
      "description": "Dọn các vật nhỏ trên sàn, vắt khăn vừa ẩm và lau một khu vực thường sử dụng.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "fad2b85d-aade-856b-a32f-c6feb3984e8d",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Dọn dẹp\",\"Sắp xếp bàn học\"]",
      "parent_id": "ea4c71f5-0bef-8da2-b542-e0b6f3587799",
      "title": "Sắp xếp bàn học",
      "description": "Cất 5 món về đúng chỗ, lau mặt bàn và để lại chỉ những thứ cần cho việc tiếp theo.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "d43ce85b-66e0-8a55-b840-5c48628c3866",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Chăm sóc quần áo\"]",
      "parent_id": "cac43533-5b8f-80ed-9c51-888ce1ba844b",
      "title": "Chăm sóc quần áo",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "b8f7106f-b338-886f-9842-db03510fbba5",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Chăm sóc quần áo\",\"Giặt quần áo\"]",
      "parent_id": "d43ce85b-66e0-8a55-b840-5c48628c3866",
      "title": "Giặt quần áo",
      "description": "Đọc nhãn chăm sóc, phân loại đồ sáng và tối màu rồi chuẩn bị một mẻ giặt.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "5d01ac9c-c982-874b-81ce-5a234708339c",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Chăm sóc quần áo\",\"Phơi đồ\"]",
      "parent_id": "d43ce85b-66e0-8a55-b840-5c48628c3866",
      "title": "Phơi đồ",
      "description": "Giũ phẳng từng món và chừa khoảng cách để đồ nhanh khô. Kiểm tra dự báo thời tiết nếu phơi ngoài trời.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "67e49671-9d82-88bf-bb23-7d50cdd65ce6",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Góc bếp\"]",
      "parent_id": "cac43533-5b8f-80ed-9c51-888ce1ba844b",
      "title": "Góc bếp",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "c06b16c2-01f2-86e8-a330-019c5b9a8048",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Góc bếp\",\"Rửa bát\"]",
      "parent_id": "67e49671-9d82-88bf-bb23-7d50cdd65ce6",
      "title": "Rửa bát",
      "description": "Dọn phần thức ăn thừa, ngâm đồ khó rửa rồi rửa từ ly cốc đến nồi chảo.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "77c624a5-9834-8662-869b-3094c640f690",
      "created_by": null,
      "system_seed_key": "node:[\"Nội trợ\",\"Góc bếp\",\"Nấu cơm\"]",
      "parent_id": "67e49671-9d82-88bf-bb23-7d50cdd65ce6",
      "title": "Nấu cơm",
      "description": "Đong lượng gạo vừa đủ, vo nhẹ, thêm nước phù hợp với loại gạo và chuẩn bị một món ăn kèm đơn giản.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "792476f3-e3aa-8796-8fd1-f1d61dcf56f9",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\"]",
      "parent_id": null,
      "title": "Nghệ thuật",
      "description": "Dành một khoảng nhỏ cho trí tưởng tượng.",
      "kind": "group",
      "enabled": true
    },
    {
      "id": "5a7bfa9d-a7a2-85f9-a9e6-c919d38e4b19",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Vẽ & sắc màu\"]",
      "parent_id": "792476f3-e3aa-8796-8fd1-f1d61dcf56f9",
      "title": "Vẽ & sắc màu",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "8ea0f2b5-1fcf-802b-8261-0c18c84260f3",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Vẽ & sắc màu\",\"Vẽ tranh\"]",
      "parent_id": "5a7bfa9d-a7a2-85f9-a9e6-c919d38e4b19",
      "title": "Vẽ tranh",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "ba50a649-0b2f-818f-9376-57353ce347a4",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Vẽ & sắc màu\",\"Vẽ tranh\",\"Vẽ phong cảnh\"]",
      "parent_id": "8ea0f2b5-1fcf-802b-8261-0c18c84260f3",
      "title": "Vẽ phong cảnh",
      "description": "Dành 20 phút phác bố cục với ba mảng sáng, trung gian và tối.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "1e2af6f6-0794-88f8-b525-800028c3b3b4",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Vẽ & sắc màu\",\"Tô màu\"]",
      "parent_id": "5a7bfa9d-a7a2-85f9-a9e6-c919d38e4b19",
      "title": "Tô màu",
      "description": "Vẽ một trang hình học đơn giản rồi thử giới hạn bảng màu ở ba sắc độ.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "ad316b13-0646-8733-9efd-996554993c48",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Thiết kế\"]",
      "parent_id": "792476f3-e3aa-8796-8fd1-f1d61dcf56f9",
      "title": "Thiết kế",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "1dd9270b-f192-80be-88ed-1022fcfd1b54",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Thiết kế\",\"Thiết kế nhà\"]",
      "parent_id": "ad316b13-0646-8733-9efd-996554993c48",
      "title": "Thiết kế nhà",
      "description": "Phác mặt bằng một không gian nhỏ. Ghi rõ lối đi, ánh sáng và nơi lưu trữ.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "616de576-135a-86d7-95c7-ebf56ea716b3",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Thiết kế\",\"Thiết kế trang sức\"]",
      "parent_id": "ad316b13-0646-8733-9efd-996554993c48",
      "title": "Thiết kế trang sức",
      "description": "Vẽ 3 phác thảo, chọn một và ghi chất liệu dự kiến.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "866c7e82-a98d-8af2-9822-5700bdf02f3b",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Thiết kế\",\"Thiết kế journal\"]",
      "parent_id": "ad316b13-0646-8733-9efd-996554993c48",
      "title": "Thiết kế journal",
      "description": "Tạo một trang ghi chép cho tuần này với ba ô: điều muốn làm, điều biết ơn và một khoảng trống sáng tạo.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "c37c3e5c-bbdb-8cea-8c9b-d67a0599139c",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Chữ & câu chuyện\"]",
      "parent_id": "792476f3-e3aa-8796-8fd1-f1d61dcf56f9",
      "title": "Chữ & câu chuyện",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "ab032852-ee7a-88cf-b90b-3b129ffcc1d5",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Chữ & câu chuyện\",\"Chép thư pháp\"]",
      "parent_id": "c37c3e5c-bbdb-8cea-8c9b-d67a0599139c",
      "title": "Chép thư pháp",
      "description": "Thả lỏng cổ tay, tập một dòng nét cơ bản rồi chép chậm đoạn nội dung.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "5c87cfa0-42d0-8828-ae50-40eb1515d2a3",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Chữ & câu chuyện\",\"Viết văn\"]",
      "parent_id": "c37c3e5c-bbdb-8cea-8c9b-d67a0599139c",
      "title": "Viết văn",
      "description": "Viết liên tục 10 phút, tạm bỏ qua việc sửa lỗi. Sau đó chọn một câu bạn thích nhất.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "94a3d690-fd6d-8009-8e46-16fa1012c97c",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Âm nhạc\"]",
      "parent_id": "792476f3-e3aa-8796-8fd1-f1d61dcf56f9",
      "title": "Âm nhạc",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "11ef1a65-a901-84fb-a6c8-c50d2c7d461b",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Âm nhạc\",\"Tập đàn kalimba\"]",
      "parent_id": "94a3d690-fd6d-8009-8e46-16fa1012c97c",
      "title": "Tập đàn kalimba",
      "description": "Tập chậm từng câu, giữ nhịp đều trước khi tăng tốc. Chỉ thêm tab/bản nhạc từ nguồn bạn có quyền sử dụng.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "16527cb4-fc82-8d1d-b52f-133ce81a835a",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Thủ công\"]",
      "parent_id": "792476f3-e3aa-8796-8fd1-f1d61dcf56f9",
      "title": "Thủ công",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "aef651d4-bbbc-81d0-a6f6-f2dfc7053935",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Thủ công\",\"Làm thiệp\"]",
      "parent_id": "16527cb4-fc82-8d1d-b52f-133ce81a835a",
      "title": "Làm thiệp",
      "description": "Gấp đôi một tờ giấy, tạo một hình cắt đơn giản và viết lời nhắn bằng chính lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "59d1ddde-abb6-87b6-9d1e-64347711eb9c",
      "created_by": null,
      "system_seed_key": "node:[\"Nghệ thuật\",\"Thủ công\",\"Gấp origami\"]",
      "parent_id": "16527cb4-fc82-8d1d-b52f-133ce81a835a",
      "title": "Gấp origami",
      "description": "Dùng một tờ giấy vuông để gấp một chiếc thuyền hoặc phong bì. Miết nếp gấp chậm và chính xác.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "1610a833-2130-835b-aeef-ef50b95e7a86",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\"]",
      "parent_id": null,
      "title": "Kiến thức",
      "description": "Mỗi ngày, hiểu thêm một điều mới.",
      "kind": "group",
      "enabled": true
    },
    {
      "id": "c34182ea-4e0d-880e-ab19-f1099d8c670e",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kinh tế\"]",
      "parent_id": "1610a833-2130-835b-aeef-ef50b95e7a86",
      "title": "Kinh tế",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "e1cb1e0a-cb98-8d70-981f-528bdb85ae03",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kinh tế\",\"Kinh tế vi mô\"]",
      "parent_id": "c34182ea-4e0d-880e-ab19-f1099d8c670e",
      "title": "Kinh tế vi mô",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "961be51c-2315-8402-ae09-fe164ad8ac57",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kinh tế\",\"Kinh tế vi mô\",\"Cung và cầu\"]",
      "parent_id": "e1cb1e0a-cb98-8d70-981f-528bdb85ae03",
      "title": "Cung và cầu",
      "description": "Học gì: Cách giá và lượng cân bằng thay đổi khi cung hoặc cầu dịch chuyển.\n\nCâu hỏi gợi mở: Vì sao giá một loại trái cây thường giảm vào chính vụ?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "45d24bfb-2b66-8433-9fef-838033285fc5",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kinh tế\",\"Kinh tế vĩ mô\"]",
      "parent_id": "c34182ea-4e0d-880e-ab19-f1099d8c670e",
      "title": "Kinh tế vĩ mô",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "12dcae0f-0148-82ad-a1a1-f23a6af2b46d",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kinh tế\",\"Kinh tế vĩ mô\",\"Lạm phát\"]",
      "parent_id": "45d24bfb-2b66-8433-9fef-838033285fc5",
      "title": "Lạm phát",
      "description": "Học gì: Phân biệt mức giá chung tăng với một mặt hàng tăng giá.\n\nCâu hỏi gợi mở: Vì sao mỗi gia đình có thể cảm nhận lạm phát khác nhau?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "7e4ae541-5920-8b48-a8fc-4c892545b971",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kinh tế\",\"Kinh tế hành vi\"]",
      "parent_id": "c34182ea-4e0d-880e-ab19-f1099d8c670e",
      "title": "Kinh tế hành vi",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "d1ce370f-95c8-85e1-ba55-a20d5cc97a63",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kinh tế\",\"Kinh tế hành vi\",\"Chi phí chìm\"]",
      "parent_id": "7e4ae541-5920-8b48-a8fc-4c892545b971",
      "title": "Chi phí chìm",
      "description": "Học gì: Nhận diện khoản chi đã xảy ra và không thể thu hồi.\n\nCâu hỏi gợi mở: Bạn có tiếp tục đọc một cuốn sách không thích chỉ vì đã mua nó?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "cc9d3146-2241-8812-999b-aecd8e0651cf",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Tâm lý học\"]",
      "parent_id": "1610a833-2130-835b-aeef-ef50b95e7a86",
      "title": "Tâm lý học",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "839ad0fc-b85e-8d9e-86cf-d31be6fd8b06",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Tâm lý học\",\"Tâm lý nhận thức\"]",
      "parent_id": "cc9d3146-2241-8812-999b-aecd8e0651cf",
      "title": "Tâm lý nhận thức",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "c11801b0-4ddc-84a2-bc4f-b7ec2958bb03",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Tâm lý học\",\"Tâm lý nhận thức\",\"Trí nhớ làm việc\"]",
      "parent_id": "839ad0fc-b85e-8d9e-86cf-d31be6fd8b06",
      "title": "Trí nhớ làm việc",
      "description": "Học gì: Vai trò của việc giữ và xử lý thông tin trong thời gian ngắn.\n\nCâu hỏi gợi mở: Vì sao chia nhỏ nhiệm vụ có thể giúp bớt quá tải?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "466786a4-4ab7-873d-8a54-3dcab97a52b0",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Tâm lý học\",\"Tâm lý xã hội\"]",
      "parent_id": "cc9d3146-2241-8812-999b-aecd8e0651cf",
      "title": "Tâm lý xã hội",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "8ab1eae8-796f-864f-bfa3-5556804f0ef9",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Tâm lý học\",\"Tâm lý xã hội\",\"Ảnh hưởng của nhóm\"]",
      "parent_id": "466786a4-4ab7-873d-8a54-3dcab97a52b0",
      "title": "Ảnh hưởng của nhóm",
      "description": "Học gì: Tìm hiểu sự tuân theo và áp lực đồng thuận qua các ví dụ đời thường.\n\nCâu hỏi gợi mở: Khi nào ý kiến số đông giúp ích, khi nào cần kiểm chứng riêng?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "491fbe1e-4a61-8746-9d8e-eda447942774",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Tâm lý học\",\"Tâm lý học phát triển\"]",
      "parent_id": "cc9d3146-2241-8812-999b-aecd8e0651cf",
      "title": "Tâm lý học phát triển",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "4fee4711-2b6e-86f5-b49f-a928a2bd62b2",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Tâm lý học\",\"Tâm lý học phát triển\",\"Học qua quan sát\"]",
      "parent_id": "491fbe1e-4a61-8746-9d8e-eda447942774",
      "title": "Học qua quan sát",
      "description": "Học gì: Cách con người học hành vi từ hình mẫu và bối cảnh.\n\nCâu hỏi gợi mở: Bạn đã học một kỹ năng nào chỉ bằng cách quan sát?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "3219a90b-28d4-8053-b593-a61e29c78316",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Huyền học & văn hóa\"]",
      "parent_id": "1610a833-2130-835b-aeef-ef50b95e7a86",
      "title": "Huyền học & văn hóa",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "9c5764bd-786b-8975-8fff-b1c244e975cd",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Huyền học & văn hóa\",\"Lịch sử tư tưởng\"]",
      "parent_id": "3219a90b-28d4-8053-b593-a61e29c78316",
      "title": "Lịch sử tư tưởng",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "c3475bad-5e26-8ec3-96f7-b45a79359586",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Huyền học & văn hóa\",\"Lịch sử tư tưởng\",\"Lịch sử chiêm tinh\"]",
      "parent_id": "9c5764bd-786b-8975-8fff-b1c244e975cd",
      "title": "Lịch sử chiêm tinh",
      "description": "Học gì: Tìm hiểu chiêm tinh trong lịch sử văn hóa; không xem dự đoán là kết luận khoa học.\n\nCâu hỏi gợi mở: Thiên văn học và chiêm tinh khác nhau về cách kiểm chứng như thế nào?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "d019769e-f1a0-8082-b49a-730fa53ca711",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Huyền học & văn hóa\",\"Biểu tượng văn hóa\"]",
      "parent_id": "3219a90b-28d4-8053-b593-a61e29c78316",
      "title": "Biểu tượng văn hóa",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "0657f3aa-f756-8c28-ab72-f32b0238a252",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Huyền học & văn hóa\",\"Biểu tượng văn hóa\",\"Biểu tượng ngũ hành\"]",
      "parent_id": "d019769e-f1a0-8082-b49a-730fa53ca711",
      "title": "Biểu tượng ngũ hành",
      "description": "Học gì: Khám phá ngũ hành như một hệ biểu tượng lịch sử trong văn hóa Đông Á.\n\nCâu hỏi gợi mở: Các biểu tượng này xuất hiện ra sao trong kiến trúc hoặc nghệ thuật?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "691dc119-492d-8232-b89a-752d33a999fc",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Huyền học & văn hóa\",\"Tư duy phản biện\"]",
      "parent_id": "3219a90b-28d4-8053-b593-a61e29c78316",
      "title": "Tư duy phản biện",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "1d5ceb61-f2bb-8b5c-a851-4308dd77ff85",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Huyền học & văn hóa\",\"Tư duy phản biện\",\"Hiệu ứng Barnum\"]",
      "parent_id": "691dc119-492d-8232-b89a-752d33a999fc",
      "title": "Hiệu ứng Barnum",
      "description": "Học gì: Tìm hiểu vì sao mô tả chung có thể được cảm nhận như dành riêng cho mình.\n\nCâu hỏi gợi mở: Làm sao thiết kế phép kiểm tra một lời dự đoán?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "ba1549e8-dc93-87dc-a5e8-c4afcb737c8c",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Công nghệ thông tin\"]",
      "parent_id": "1610a833-2130-835b-aeef-ef50b95e7a86",
      "title": "Công nghệ thông tin",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "489e5dee-75bc-8dc2-a6b3-6134748cd1b4",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Công nghệ thông tin\",\"Mạng máy tính\"]",
      "parent_id": "ba1549e8-dc93-87dc-a5e8-c4afcb737c8c",
      "title": "Mạng máy tính",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "49a50a34-526f-8b19-93c2-37a4c8ce3c90",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Công nghệ thông tin\",\"Mạng máy tính\",\"DNS\"]",
      "parent_id": "489e5dee-75bc-8dc2-a6b3-6134748cd1b4",
      "title": "DNS",
      "description": "Học gì: Theo dấu quá trình chuyển tên miền thành địa chỉ IP và vai trò bộ nhớ đệm.\n\nCâu hỏi gợi mở: Trình duyệt cần hỏi những đâu trước khi kết nối tới một website?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "7173bb4e-43cd-8712-90ed-61261b61d489",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Công nghệ thông tin\",\"Lập trình\"]",
      "parent_id": "ba1549e8-dc93-87dc-a5e8-c4afcb737c8c",
      "title": "Lập trình",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "6f14f839-e8fd-81f0-8fce-6e0c92cf9a2b",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Công nghệ thông tin\",\"Lập trình\",\"Cấu trúc dữ liệu cây\"]",
      "parent_id": "7173bb4e-43cd-8712-90ed-61261b61d489",
      "title": "Cấu trúc dữ liệu cây",
      "description": "Học gì: Khái niệm gốc, cha, con, lá và cách duyệt cây.\n\nCâu hỏi gợi mở: Bạn sẽ mô tả thư mục máy tính bằng một cấu trúc cây như thế nào?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "b02eda13-92da-86cc-b481-e3f9e1d8d4ca",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Công nghệ thông tin\",\"An toàn thông tin\"]",
      "parent_id": "ba1549e8-dc93-87dc-a5e8-c4afcb737c8c",
      "title": "An toàn thông tin",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "29b647e7-4b61-8279-ade4-cde01733a495",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Công nghệ thông tin\",\"An toàn thông tin\",\"Hàm băm và mật khẩu\"]",
      "parent_id": "b02eda13-92da-86cc-b481-e3f9e1d8d4ca",
      "title": "Hàm băm và mật khẩu",
      "description": "Học gì: Phân biệt băm với mã hóa và tìm hiểu vai trò của salt.\n\nCâu hỏi gợi mở: Vì sao hai tài khoản cùng mật khẩu vẫn nên có giá trị lưu khác nhau?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "3bcf1cc1-ebe3-8b02-9cec-2f6b6e9d1e66",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Robot\"]",
      "parent_id": "1610a833-2130-835b-aeef-ef50b95e7a86",
      "title": "Robot",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "af12aefc-6d0f-8c1e-94e6-6212cac0520d",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Robot\",\"Robot công nghiệp\"]",
      "parent_id": "3bcf1cc1-ebe3-8b02-9cec-2f6b6e9d1e66",
      "title": "Robot công nghiệp",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "03de6ee6-c868-864f-a5c2-6a10ce29f6b7",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Robot\",\"Robot công nghiệp\",\"Khớp và bậc tự do\"]",
      "parent_id": "af12aefc-6d0f-8c1e-94e6-6212cac0520d",
      "title": "Khớp và bậc tự do",
      "description": "Học gì: Phân biệt khớp quay, khớp tịnh tiến và bậc tự do.\n\nCâu hỏi gợi mở: Một cánh tay robot cần bao nhiêu chuyển động độc lập để định vị và định hướng đầu công tác?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "3ed535e3-3397-84b9-a36e-e9218378c775",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Robot\",\"Robot công nghiệp\",\"Động học thuận\"]",
      "parent_id": "af12aefc-6d0f-8c1e-94e6-6212cac0520d",
      "title": "Động học thuận",
      "description": "Học gì: Từ góc khớp tính vị trí đầu công tác qua một tay máy phẳng hai khâu.\n\nCâu hỏi gợi mở: Khi giữ nguyên khớp thứ nhất và xoay khớp thứ hai, đầu công tác đi theo quỹ đạo gì?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "5c6863fa-6ab3-8213-91f2-2a5e9d635152",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Robot\",\"Robot di động\"]",
      "parent_id": "3bcf1cc1-ebe3-8b02-9cec-2f6b6e9d1e66",
      "title": "Robot di động",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "d5bfead0-3836-868c-949e-806ce6e092da",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Robot\",\"Robot di động\",\"Định vị robot\"]",
      "parent_id": "5c6863fa-6ab3-8213-91f2-2a5e9d635152",
      "title": "Định vị robot",
      "description": "Học gì: So sánh thông tin từ encoder, camera và cảm biến khoảng cách.\n\nCâu hỏi gợi mở: Vì sao chỉ đếm vòng bánh xe có thể tích lũy sai số?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "207ee45a-3ed9-8ea4-89a2-fdbb7f5ea2d1",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Robot\",\"Cảm biến robot\"]",
      "parent_id": "3bcf1cc1-ebe3-8b02-9cec-2f6b6e9d1e66",
      "title": "Cảm biến robot",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "35e1d6d0-d239-8ff9-a3b1-6c3f30f4a4be",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Robot\",\"Cảm biến robot\",\"Cảm biến khoảng cách\"]",
      "parent_id": "207ee45a-3ed9-8ea4-89a2-fdbb7f5ea2d1",
      "title": "Cảm biến khoảng cách",
      "description": "Học gì: So sánh nguyên lý siêu âm và đo thời gian bay của ánh sáng.\n\nCâu hỏi gợi mở: Bề mặt mềm hoặc tối có thể ảnh hưởng phép đo thế nào?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "eb15476d-24bd-89bc-a7da-f6fc3a2d22e4",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kỹ thuật cơ điện\"]",
      "parent_id": "1610a833-2130-835b-aeef-ef50b95e7a86",
      "title": "Kỹ thuật cơ điện",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "4cc51291-090b-852b-80af-22dde36dd808",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kỹ thuật cơ điện\",\"Động cơ\"]",
      "parent_id": "eb15476d-24bd-89bc-a7da-f6fc3a2d22e4",
      "title": "Động cơ",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "aeb1ae4e-caa1-8232-b938-51efe3f39499",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kỹ thuật cơ điện\",\"Động cơ\",\"Động cơ bước\"]",
      "parent_id": "4cc51291-090b-852b-80af-22dde36dd808",
      "title": "Động cơ bước",
      "description": "Học gì: Cách chuỗi xung điều khiển các bước quay và khái niệm mất bước.\n\nCâu hỏi gợi mở: Tại sao cần chọn gia tốc thay vì tăng tốc độ tức thì?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "07b65c94-8cb7-8b5c-8365-49f471ac3065",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kỹ thuật cơ điện\",\"Điều khiển\"]",
      "parent_id": "eb15476d-24bd-89bc-a7da-f6fc3a2d22e4",
      "title": "Điều khiển",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "9bd048f7-6a7b-8e09-891f-5c651cfdda1b",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kỹ thuật cơ điện\",\"Điều khiển\",\"Phản hồi và PID\"]",
      "parent_id": "07b65c94-8cb7-8b5c-8365-49f471ac3065",
      "title": "Phản hồi và PID",
      "description": "Học gì: Tìm hiểu sai số và tác dụng định tính của ba thành phần P, I, D.\n\nCâu hỏi gợi mở: Điều gì xảy ra nếu phản hồi quá chậm?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "573f84df-0d4a-8b99-bde3-beaea97d3709",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kỹ thuật cơ điện\",\"Truyền động\"]",
      "parent_id": "eb15476d-24bd-89bc-a7da-f6fc3a2d22e4",
      "title": "Truyền động",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "91ad1fdc-740f-8d07-990e-8f9e8d202835",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Kỹ thuật cơ điện\",\"Truyền động\",\"Vít me và đai ốc\"]",
      "parent_id": "573f84df-0d4a-8b99-bde3-beaea97d3709",
      "title": "Vít me và đai ốc",
      "description": "Học gì: Cách chuyển chuyển động quay thành tịnh tiến.\n\nCâu hỏi gợi mở: Bước vít ảnh hưởng thế nào tới tốc độ và lực?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "9367026a-a795-82f4-b1f9-438f9778bd90",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Máy móc\"]",
      "parent_id": "1610a833-2130-835b-aeef-ef50b95e7a86",
      "title": "Máy móc",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "091e5920-4cc1-8e0e-8e68-6d346a4fd1f8",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Máy móc\",\"Cơ cấu cơ khí\"]",
      "parent_id": "9367026a-a795-82f4-b1f9-438f9778bd90",
      "title": "Cơ cấu cơ khí",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "4429aac2-0075-8fcd-b602-d0f1a79c994a",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Máy móc\",\"Cơ cấu cơ khí\",\"Cơ cấu tay quay – con trượt\"]",
      "parent_id": "091e5920-4cc1-8e0e-8e68-6d346a4fd1f8",
      "title": "Cơ cấu tay quay – con trượt",
      "description": "Học gì: Quan sát cách chuyển chuyển động quay thành qua lại.\n\nCâu hỏi gợi mở: Vì sao tốc độ con trượt không đều dù tay quay quay đều?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "38577072-cd9a-875b-b7c3-c32f4ff8b53a",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Máy móc\",\"Chi tiết máy\"]",
      "parent_id": "9367026a-a795-82f4-b1f9-438f9778bd90",
      "title": "Chi tiết máy",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "b7447501-b2de-8648-8565-b339f2b33cd9",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Máy móc\",\"Chi tiết máy\",\"Bánh răng và tỷ số truyền\"]",
      "parent_id": "38577072-cd9a-875b-b7c3-c32f4ff8b53a",
      "title": "Bánh răng và tỷ số truyền",
      "description": "Học gì: Đếm số răng để tính tỷ số tốc độ giữa hai bánh.\n\nCâu hỏi gợi mở: Muốn giảm tốc và tăng mô-men, bánh bị dẫn nên lớn hay nhỏ?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    },
    {
      "id": "c9c47821-c49c-81ea-bc0f-6065c91160b6",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Máy móc\",\"Bảo trì\"]",
      "parent_id": "9367026a-a795-82f4-b1f9-438f9778bd90",
      "title": "Bảo trì",
      "description": null,
      "kind": "group",
      "enabled": true
    },
    {
      "id": "2cb0f92f-9c84-8acf-8185-549aefe9af44",
      "created_by": null,
      "system_seed_key": "node:[\"Kiến thức\",\"Máy móc\",\"Bảo trì\",\"Ma sát và bôi trơn\"]",
      "parent_id": "c9c47821-c49c-81ea-bc0f-6065c91160b6",
      "title": "Ma sát và bôi trơn",
      "description": "Học gì: Vai trò của màng bôi trơn, nhiệt và sự mài mòn.\n\nCâu hỏi gợi mở: Vì sao quá nhiều chất bôi trơn cũng có thể gây vấn đề?\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.",
      "kind": "activity",
      "enabled": true
    }
  ],
  "activity_variants": [
    {
      "id": "4c41f7ca-94ed-8bf8-9d57-35a20f60d42a",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Vẽ & sắc màu\",\"Vẽ tranh\",\"Vẽ phong cảnh\",\"Rừng mùa thu\"]",
      "node_id": "ba50a649-0b2f-818f-9376-57353ce347a4",
      "title": "Rừng mùa thu",
      "description": "Tưởng tượng một lối mòn giữa rừng, tán lá vàng cam và ánh nắng xiên. Chọn ba màu chính."
    },
    {
      "id": "4856aa6c-a69d-8323-a35a-6d53f12b0602",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Vẽ & sắc màu\",\"Vẽ tranh\",\"Vẽ phong cảnh\",\"Góc biển yên bình\"]",
      "node_id": "ba50a649-0b2f-818f-9376-57353ce347a4",
      "title": "Góc biển yên bình",
      "description": "Vẽ đường chân trời thấp, một chiếc thuyền nhỏ và các dải sóng bằng nét đơn giản."
    },
    {
      "id": "50581ee1-c8cf-8c28-95bb-45167ead9502",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Vẽ & sắc màu\",\"Vẽ tranh\",\"Vẽ phong cảnh\",\"Thành phố sau mưa\"]",
      "node_id": "ba50a649-0b2f-818f-9376-57353ce347a4",
      "title": "Thành phố sau mưa",
      "description": "Phác vài mái nhà và bóng phản chiếu. Dùng sắc xanh xám cùng một điểm nhấn ấm."
    },
    {
      "id": "30c36be1-4ee9-80f6-bd3a-423e76a49298",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Vẽ & sắc màu\",\"Tô màu\",\"Khu vườn pastel\"]",
      "node_id": "1e2af6f6-0794-88f8-b525-800028c3b3b4",
      "title": "Khu vườn pastel",
      "description": "Tạo 5 hình lá và tô các sắc xanh, hồng nhạt, tím."
    },
    {
      "id": "eb361005-fc85-823a-8d23-d399ee303309",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Vẽ & sắc màu\",\"Tô màu\",\"Những ô cửa\"]",
      "node_id": "1e2af6f6-0794-88f8-b525-800028c3b3b4",
      "title": "Những ô cửa",
      "description": "Tô một dãy ô cửa, thay đổi độ đậm nhạt để tạo nhịp điệu."
    },
    {
      "id": "a27f2ff9-b7bd-88df-acf9-0955cc60ace2",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Thiết kế\",\"Thiết kế nhà\",\"Căn phòng đọc sách\"]",
      "node_id": "1dd9270b-f192-80be-88ed-1022fcfd1b54",
      "title": "Căn phòng đọc sách",
      "description": "Một góc 3 × 3 m với kệ sách, ghế và cửa sổ. Hãy ưu tiên ánh sáng tự nhiên."
    },
    {
      "id": "3c48666c-0c40-8511-8f57-d7e03f7699b7",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Thiết kế\",\"Thiết kế nhà\",\"Ngôi nhà bên đồi\"]",
      "node_id": "1dd9270b-f192-80be-88ed-1022fcfd1b54",
      "title": "Ngôi nhà bên đồi",
      "description": "Phác mái nhà và hiên nhìn ra vườn. Dùng vật liệu gỗ và đá trong ý tưởng."
    },
    {
      "id": "562a0637-d151-8da2-9476-ea8b54217a47",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Thiết kế\",\"Thiết kế trang sức\",\"Mặt dây giọt sương\"]",
      "node_id": "616de576-135a-86d7-95c7-ebf56ea716b3",
      "title": "Mặt dây giọt sương",
      "description": "Thiết kế từ đường cong mềm, một hạt thủy tinh và dây mảnh."
    },
    {
      "id": "13a751ce-4aa7-8bfb-84b7-f788d06b61d9",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Thiết kế\",\"Thiết kế trang sức\",\"Chiếc nhẫn chiếc lá\"]",
      "node_id": "616de576-135a-86d7-95c7-ebf56ea716b3",
      "title": "Chiếc nhẫn chiếc lá",
      "description": "Lấy gân lá làm họa tiết, nghĩ về cách đeo thoải mái."
    },
    {
      "id": "b62f6519-47c8-87ed-b6c7-389b423e9e08",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Chữ & câu chuyện\",\"Chép thư pháp\",\"Một bước nhỏ\"]",
      "node_id": "ab032852-ee7a-88cf-b90b-3b129ffcc1d5",
      "title": "Một bước nhỏ",
      "description": "Tập bố cục thoáng, nhấn vào các từ bạn thấy ý nghĩa."
    },
    {
      "id": "b6d4071d-2cd2-80bb-a551-ebe38cabc0f7",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Chữ & câu chuyện\",\"Chép thư pháp\",\"Khoảng trời riêng\"]",
      "node_id": "ab032852-ee7a-88cf-b90b-3b129ffcc1d5",
      "title": "Khoảng trời riêng",
      "description": "Thử viết bằng hai cỡ chữ, để khoảng trắng bao quanh."
    },
    {
      "id": "1b15985d-0988-8c27-933f-0315df68cff1",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Chữ & câu chuyện\",\"Viết văn\",\"Lá thư từ tương lai\"]",
      "node_id": "5c87cfa0-42d0-8828-ae50-40eb1515d2a3",
      "title": "Lá thư từ tương lai",
      "description": "Viết một lá thư cho chính mình của một năm sau."
    },
    {
      "id": "33dbb85b-9bad-87dd-a804-b700ba8c4e71",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Chữ & câu chuyện\",\"Viết văn\",\"Một quán nhỏ trong mưa\"]",
      "node_id": "5c87cfa0-42d0-8828-ae50-40eb1515d2a3",
      "title": "Một quán nhỏ trong mưa",
      "description": "Miêu tả một quán bạn tưởng tượng bằng đủ năm giác quan."
    },
    {
      "id": "a55b90ba-95e3-8b1a-90da-0f7b73d09813",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Âm nhạc\",\"Tập đàn kalimba\",\"Twinkle, Twinkle, Little Star\"]",
      "node_id": "11ef1a65-a901-84fb-a6c8-c50d2c7d461b",
      "title": "Twinkle, Twinkle, Little Star",
      "description": "Thử tìm giai điệu bài truyền thống bằng tai, bắt đầu với các nốt Đô–Đô–Sol–Sol–La–La–Sol. Chưa có bản nhạc tham khảo."
    },
    {
      "id": "abd3d2fe-4b3d-873f-89e8-95b209403f13",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Âm nhạc\",\"Tập đàn kalimba\",\"Frère Jacques\"]",
      "node_id": "11ef1a65-a901-84fb-a6c8-c50d2c7d461b",
      "title": "Frère Jacques",
      "description": "Tập giai điệu dân ca truyền thống theo từng câu ngắn. Bạn có thể thêm URL hướng dẫn của mình trong Thư viện."
    },
    {
      "id": "256eb390-b705-8346-93cf-cb7f54a1b2a8",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Thủ công\",\"Làm thiệp\",\"Lời cảm ơn nhỏ\"]",
      "node_id": "aef651d4-bbbc-81d0-a6f6-f2dfc7053935",
      "title": "Lời cảm ơn nhỏ",
      "description": "Làm một tấm thiệp cho người đã giúp bạn gần đây."
    },
    {
      "id": "ba96ebb6-d97a-84ee-a39e-c0f7d126a9af",
      "created_by": null,
      "system_seed_key": "variant:[\"Nghệ thuật\",\"Thủ công\",\"Làm thiệp\",\"Chúc một ngày vui\"]",
      "node_id": "aef651d4-bbbc-81d0-a6f6-f2dfc7053935",
      "title": "Chúc một ngày vui",
      "description": "Dùng hình mặt trời và hai màu tương phản nhẹ."
    }
  ],
  "resources": [
    {
      "id": "e5e8df9e-1ab1-842c-b792-4e7dfcf13722",
      "created_by": null,
      "system_seed_key": "resource:[\"Nghệ thuật\",\"Chữ & câu chuyện\",\"Chép thư pháp\",\"@variant\",\"Một bước nhỏ\",\"Nội dung để bắt đầu\"]",
      "node_id": "ab032852-ee7a-88cf-b90b-3b129ffcc1d5",
      "variant_id": "b62f6519-47c8-87ed-b6c7-389b423e9e08",
      "title": "Nội dung để bắt đầu",
      "type": "text",
      "url": null,
      "content": "Một bước nhỏ hôm nay\nMở thêm một lối ngày mai.\nChậm thôi, nhưng cứ bước\nBình yên ở trong tay."
    },
    {
      "id": "3b9e0ab2-60d2-8bed-a192-743c4bd5ca31",
      "created_by": null,
      "system_seed_key": "resource:[\"Nghệ thuật\",\"Chữ & câu chuyện\",\"Chép thư pháp\",\"@variant\",\"Khoảng trời riêng\",\"Nội dung để bắt đầu\"]",
      "node_id": "ab032852-ee7a-88cf-b90b-3b129ffcc1d5",
      "variant_id": "b6d4071d-2cd2-80bb-a551-ebe38cabc0f7",
      "title": "Nội dung để bắt đầu",
      "type": "text",
      "url": null,
      "content": "Giữ một khoảng trời trong lòng, để mỗi ngày đều có chỗ cho điều mới."
    },
    {
      "id": "6937e7b0-f486-8c03-8beb-f5bac24e37f1",
      "created_by": null,
      "system_seed_key": "resource:[\"Nghệ thuật\",\"Chữ & câu chuyện\",\"Viết văn\",\"@variant\",\"Lá thư từ tương lai\",\"Nội dung để bắt đầu\"]",
      "node_id": "5c87cfa0-42d0-8828-ae50-40eb1515d2a3",
      "variant_id": "1b15985d-0988-8c27-933f-0315df68cff1",
      "title": "Nội dung để bắt đầu",
      "type": "text",
      "url": null,
      "content": "Bạn đang ở đâu? Điều gì từng khó nhưng nay đã trở nên quen thuộc? Hãy bắt đầu bằng: “Chào bạn của ngày hôm nay…”"
    },
    {
      "id": "6e4f9123-fad5-874f-a362-3265d7655a88",
      "created_by": null,
      "system_seed_key": "resource:[\"Nghệ thuật\",\"Chữ & câu chuyện\",\"Viết văn\",\"@variant\",\"Một quán nhỏ trong mưa\",\"Nội dung để bắt đầu\"]",
      "node_id": "5c87cfa0-42d0-8828-ae50-40eb1515d2a3",
      "variant_id": "33dbb85b-9bad-87dd-a804-b700ba8c4e71",
      "title": "Nội dung để bắt đầu",
      "type": "text",
      "url": null,
      "content": "Nhân vật bước vào quán để tránh mưa và thấy một món đồ mình tưởng đã mất. Điều gì xảy ra tiếp theo?"
    }
  ]
}$seed_payload$::jsonb; r jsonb; t text; fields text;
begin
  if exists(select 1 from random_activity_internal.migration_history where version='002_system_seed') then
    raise notice '002_system_seed already complete; seed data untouched (including moderated edits/deletions).';
    return;
  end if;
  foreach t in array array['activity_nodes','activity_variants','resources'] loop
    fields := case t
      when 'activity_nodes' then 'id,parent_id,created_by,system_seed_key,title,description,kind,enabled'
      when 'activity_variants' then 'id,node_id,created_by,system_seed_key,title,description'
      when 'resources' then 'id,node_id,variant_id,created_by,system_seed_key,title,type,url,content'
    end;
    -- Nodes appear parent-first. Each INSERT is a separate statement for parent validation triggers.
    for r in select value from jsonb_array_elements(payload->t) loop
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) on conflict (system_seed_key) do nothing',t,fields,fields,t) using r;
    end loop;
  end loop;
  insert into random_activity_internal.migration_history(version,checksum) values('002_system_seed','69bea1074692d1566e861744a93732f663c892d36db5904887306e641a389cc5');
end;
$seed$;
notify pgrst, 'reload schema';
commit;
-- SQL Editor displays counts and the completed ledger entry. Existing member rows are not included.
select 'activity_nodes' as content_table,count(*) as system_rows from public.activity_nodes where system_seed_key is not null
union all select 'activity_variants',count(*) from public.activity_variants where system_seed_key is not null
union all select 'resources',count(*) from public.resources where system_seed_key is not null;
