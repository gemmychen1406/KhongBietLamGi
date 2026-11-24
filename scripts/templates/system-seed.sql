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
  if exists(select 1 from random_activity_internal.migration_history where version='002_system_seed' and checksum <> '__CHECKSUM__') then
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
declare payload jsonb := $seed_payload$__PAYLOAD__$seed_payload$::jsonb; r jsonb; t text; fields text;
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
  insert into random_activity_internal.migration_history(version,checksum) values('002_system_seed','__CHECKSUM__');
end;
$seed$;
notify pgrst, 'reload schema';
commit;
-- SQL Editor displays counts and the completed ledger entry. Existing member rows are not included.
select 'activity_nodes' as content_table,count(*) as system_rows from public.activity_nodes where system_seed_key is not null
union all select 'activity_variants',count(*) from public.activity_variants where system_seed_key is not null
union all select 'resources',count(*) from public.resources where system_seed_key is not null;
