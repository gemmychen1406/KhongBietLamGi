-- 003: Members can edit public content; deletion remains owner/Admin only.
-- Run the entire file as postgres in SQL Editor, after 001 and 002. Safe to rerun.
-- No existing content is deleted or reassigned; 001/002 and their seed ledger stay untouched.
begin;
select pg_advisory_xact_lock(72819403);
do $preflight$
declare t text; versions text;
begin
 if to_regclass('supabase_migrations.schema_migrations') is not null then
   execute 'select string_agg(version::text,'', '' order by version::text) from supabase_migrations.schema_migrations' into versions;
   raise notice 'Existing Supabase migration history: %', coalesce(versions,'(empty)');
 end if;
 foreach t in array array['activity_nodes','activity_variants','resources'] loop
   if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='system_seed_key' and data_type='text') then
     raise exception 'Run 002_system_seed.sql first. Missing %.system_seed_key; nothing changed.',t;
   end if;
 end loop;
 if to_regprocedure('public.is_admin()') is null or to_regclass('random_activity_internal.migration_history') is null then
   raise exception 'Community schema is not ready; apply 001/002 first without resetting existing data.';
 end if;
 if exists(select 1 from random_activity_internal.migration_history where version='003_collaborative_editing' and checksum <> 'collaborative-editing-v1') then
   raise exception '003 history differs; stopping safely.';
 end if;
end;
$preflight$;

do $columns$
declare t text;
begin
 foreach t in array array['activity_nodes','activity_variants','resources'] loop
   execute format('alter table public.%I add column if not exists updated_by uuid references auth.users(id) on delete restrict',t);
   -- Existing rows have unknown last-edit time; do not manufacture edit attribution.
   execute format('alter table public.%I add column if not exists updated_at timestamptz',t);
   execute format('alter table public.%I alter column updated_at set default now()',t);
   execute format('alter table public.%I add column if not exists revision bigint not null default 0 check (revision >= 0)',t);
   execute format('create index if not exists %I on public.%I(updated_by)',t||'_updated_by_idx',t);
   execute format('alter table public.%I enable row level security',t);
   execute format('grant select on public.%I to anon,authenticated',t);
   execute format('grant insert,update,delete on public.%I to authenticated',t);
   execute format('drop policy if exists update_public_members on public.%I',t);
   execute format('create policy update_public_members on public.%I for update to authenticated using ((select auth.uid()) is not null and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in (''member'',''admin''))) with check ((select auth.uid()) is not null and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in (''member'',''admin'')))',t);
   -- Restrictive guards also protect installations with extra permissive policies.
   execute format('drop policy if exists collaborative_update_guard on public.%I',t);
   execute format('create policy collaborative_update_guard on public.%I as restrictive for update to authenticated using ((select auth.uid()) is not null and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in (''member'',''admin''))) with check ((select auth.uid()) is not null and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in (''member'',''admin'')))',t);
   execute format('drop policy if exists collaborative_delete_guard on public.%I',t);
   execute format('create policy collaborative_delete_guard on public.%I as restrictive for delete to authenticated using (created_by=(select auth.uid()) or (select public.is_admin()))',t);
   execute format('drop policy if exists collaborative_insert_guard on public.%I',t);
   execute format('create policy collaborative_insert_guard on public.%I as restrictive for insert to authenticated with check (created_by=(select auth.uid()) and system_seed_key is null and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in (''member'',''admin'')))',t);
 end loop;
end;
$columns$;
-- Profile roles can only be changed through the existing Admin-only RPC or trusted SQL.
alter table public.profiles enable row level security;
revoke insert,update,delete on public.profiles from anon,authenticated;
create or replace function public.guard_collaborative_content() returns trigger
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
  if TG_OP='UPDATE' then
    new.revision := old.revision + 1;
  else
    new.revision := 0;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := clock_timestamp();
  return new;
end;
$guard$;
revoke all on function public.guard_collaborative_content() from public;
-- A separate trigger survives a safe rerun of the already-shipped 002 seed migration.
-- Keep the 002 validation trigger as well; only this trigger stamps audit/revision fields.
do $triggers$
declare t text;
begin
 foreach t in array array['activity_nodes','activity_variants','resources'] loop
   execute format('drop trigger if exists %I on public.%I','collaborative_guard_'||t,t);
   execute format('create trigger %I before insert or update on public.%I for each row execute function public.guard_collaborative_content()','collaborative_guard_'||t,t);
 end loop;
end;
$triggers$;

-- Preserve RLS (SECURITY INVOKER) and commit the whole editor save atomically.
-- Revision checks reject stale editors even if a value changed and was later changed back.
create or replace function public.apply_community_changes(changes jsonb) returns void
language plpgsql security invoker set search_path = '' as $changes$
declare c jsonb; t text; fields text; assignments text; current_row jsonb; affected integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('member','admin')) then
   raise exception 'Cần đăng nhập bằng tài khoản thành viên hợp lệ' using errcode='42501';
 end if;
 if changes is null or jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes)>10000 then raise exception 'Danh sách thay đổi không hợp lệ'; end if;
 for c in select value from jsonb_array_elements(changes) loop
   t:=c->>'table';
   case t
   when 'activity_nodes' then fields:='id,created_by,parent_id,title,description,kind,enabled'; assignments:='(parent_id,title,description,kind,enabled) = (select parent_id,title,description,kind,enabled from jsonb_populate_record(null::public.activity_nodes,$1))';
   when 'activity_variants' then fields:='id,created_by,node_id,title,description'; assignments:='(node_id,title,description) = (select node_id,title,description from jsonb_populate_record(null::public.activity_variants,$1))';
   when 'resources' then fields:='id,created_by,node_id,variant_id,title,type,url,content'; assignments:='(node_id,variant_id,title,type,url,content) = (select node_id,variant_id,title,type,url,content from jsonb_populate_record(null::public.resources,$1))';
   else raise exception 'Bảng không hợp lệ'; end case;
   if c->>'op' in ('update','delete') then
     if jsonb_typeof(c->'before') is distinct from 'object' or not (c->'before' ? 'revision') then
       raise exception 'Thiếu phiên bản bản ghi. Tải lại website trước khi lưu.' using errcode='40001';
     end if;
     if c->'before'->>'id' is distinct from c->'data'->>'id' then
       raise exception 'Không được đổi ID' using errcode='42501';
     end if;
     execute format('select to_jsonb(r) from public.%I r where id=$1 for update',t) into current_row using (c->'data'->>'id')::uuid;
     if current_row is null or not (current_row @> (c->'before')) then
       raise exception 'Nội dung đã thay đổi; tải lại trước khi lưu' using errcode='40001';
     end if;
     if c->'data'->'created_by' is distinct from current_row->'created_by'
       or coalesce(c->'data'->'system_seed_key','null'::jsonb) is distinct from coalesce(current_row->'system_seed_key','null'::jsonb) then
       raise exception 'Không được đổi người tạo hoặc quyền sở hữu hệ thống' using errcode='42501';
     end if;
     if c->>'op'='delete' and not ((current_row->>'created_by')::uuid is not distinct from auth.uid() or public.is_admin()) then
       raise exception 'Chỉ tác giả hoặc Admin được xóa nội dung' using errcode='42501';
     end if;
   elsif c->>'op'='insert' then
     if (c->'data'->>'created_by')::uuid is distinct from auth.uid() or c->'data'->>'system_seed_key' is not null then
       raise exception 'Nội dung mới phải thuộc tài khoản đang đăng nhập' using errcode='42501';
     end if;
   end if;
   case c->>'op'
   when 'insert' then execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1)',t,fields,fields,t) using c->'data';
   when 'update' then execute format('update public.%I set %s where id=$2',t,assignments) using c->'data',(c->'data'->>'id')::uuid;
   when 'delete' then execute format('delete from public.%I where id=$1',t) using (c->'data'->>'id')::uuid;
   else raise exception 'Thao tác không hợp lệ'; end case;
   get diagnostics affected = row_count;
   if affected <> 1 then raise exception 'Không có quyền hoặc dữ liệu đã thay đổi' using errcode='40001'; end if;
 end loop;
end;
$changes$;
revoke all on function public.apply_community_changes(jsonb) from public,anon;
grant execute on function public.apply_community_changes(jsonb) to authenticated;
insert into random_activity_internal.migration_history(version,checksum)
 values('003_collaborative_editing','collaborative-editing-v1') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
