-- Run once in Supabase SQL Editor, as postgres. No client secret is needed.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete restrict,
 display_name text not null check (length(btrim(display_name)) between 1 and 100),
 role text not null default 'member' check (role in ('member','admin'))
);
alter table public.profiles enable row level security;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
-- Roles may ONLY be changed by trusted SQL administration. No profile write grants to clients.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id, display_name) values (new.id, coalesce(nullif(left(btrim(new.raw_user_meta_data->>'display_name'),100),''),'Thành viên'));
 return new;
end; $$;
revoke all on function public.create_profile() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
insert into public.profiles(id,display_name) select id,'Thành viên' from auth.users on conflict do nothing;
create table public.activity_nodes (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid references public.activity_nodes(id) on delete restrict,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
 title text not null check (length(btrim(title)) between 1 and 500),
 description text check (length(description) <= 100000),
 kind text not null check (kind in ('group','activity')),
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 check (parent_id is distinct from id)
);
create table public.activity_variants (
 id uuid primary key default gen_random_uuid(),
 node_id uuid not null references public.activity_nodes(id) on delete restrict,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
 title text not null check (length(btrim(title)) between 1 and 500),
 description text check (length(description) <= 100000),
 created_at timestamptz not null default now(),
 unique(id,node_id)
);
create table public.resources (
 id uuid primary key default gen_random_uuid(),
 node_id uuid not null references public.activity_nodes(id) on delete restrict,
 variant_id uuid,
 created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
 title text not null check (length(btrim(title)) between 1 and 500),
 type text not null check (type in ('text','image','link','music_sheet')),
 url text check (length(url) <= 10000 and url ~* '^https?://[^/@[:space:]]+([/:?#]|$)' and url !~* '^https?://[^/]*@'),
 content text check (length(content) <= 100000),
 created_at timestamptz not null default now(),
 foreign key (variant_id,node_id) references public.activity_variants(id,node_id) on delete restrict,
 check (case when type = 'text' then length(btrim(content)) > 0 else url is not null end)
);
-- COALESCE is essential: SQL CHECK accepts NULL.
alter table public.resources add constraint resource_required check (coalesce(case when type='text' then length(btrim(content))>0 else url is not null end,false));
create index nodes_parent_idx on public.activity_nodes(parent_id);
create index variants_node_idx on public.activity_variants(node_id);
create index resources_node_variant_idx on public.resources(node_id,variant_id);
create index resources_variant_idx on public.resources(variant_id);
-- Parent/target and ownership are immutable. This also prevents cycles and contribution relocation.
create function public.guard_content() returns trigger language plpgsql set search_path = '' as $$
declare target_kind text;
begin
 if TG_OP='UPDATE' then
  if new.id <> old.id or new.created_by <> old.created_by or new.created_at <> old.created_at then
   raise exception 'Không được đổi ID, người tạo hoặc thời điểm tạo' using errcode='42501';
  end if;
  if TG_TABLE_NAME='activity_nodes' then
   if new.parent_id is distinct from old.parent_id or new.kind <> old.kind then raise exception 'Không được di chuyển hoặc đổi loại nhánh'; end if;
  elsif TG_TABLE_NAME='activity_variants' then
   if new.node_id <> old.node_id then raise exception 'Không được di chuyển biến thể'; end if;
  else
   if new.node_id <> old.node_id or new.variant_id is distinct from old.variant_id then raise exception 'Không được di chuyển tài nguyên'; end if;
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
end; $$;
revoke all on function public.guard_content() from public;

alter table public.activity_nodes enable row level security;
revoke all on public.activity_nodes from anon, authenticated;
grant select on public.activity_nodes to anon, authenticated;
grant insert, update, delete on public.activity_nodes to authenticated;
create index activity_nodes_creator_idx on public.activity_nodes(created_by);
create trigger guard_activity_nodes before insert or update on public.activity_nodes for each row execute function public.guard_content();
create policy read_public on public.activity_nodes for select to anon,authenticated using (true);
create policy insert_own on public.activity_nodes for insert to authenticated with check (created_by=(select auth.uid()));
create policy update_own on public.activity_nodes for update to authenticated using (created_by=(select auth.uid()) or (select public.is_admin())) with check (created_by=(select auth.uid()) or (select public.is_admin()));
create policy delete_own on public.activity_nodes for delete to authenticated using (created_by=(select auth.uid()) or (select public.is_admin()));

alter table public.activity_variants enable row level security;
revoke all on public.activity_variants from anon, authenticated;
grant select on public.activity_variants to anon, authenticated;
grant insert, update, delete on public.activity_variants to authenticated;
create index activity_variants_creator_idx on public.activity_variants(created_by);
create trigger guard_activity_variants before insert or update on public.activity_variants for each row execute function public.guard_content();
create policy read_public on public.activity_variants for select to anon,authenticated using (true);
create policy insert_own on public.activity_variants for insert to authenticated with check (created_by=(select auth.uid()));
create policy update_own on public.activity_variants for update to authenticated using (created_by=(select auth.uid()) or (select public.is_admin())) with check (created_by=(select auth.uid()) or (select public.is_admin()));
create policy delete_own on public.activity_variants for delete to authenticated using (created_by=(select auth.uid()) or (select public.is_admin()));

alter table public.resources enable row level security;
revoke all on public.resources from anon, authenticated;
grant select on public.resources to anon, authenticated;
grant insert, update, delete on public.resources to authenticated;
create index resources_creator_idx on public.resources(created_by);
create trigger guard_resources before insert or update on public.resources for each row execute function public.guard_content();
create policy read_public on public.resources for select to anon,authenticated using (true);
create policy insert_own on public.resources for insert to authenticated with check (created_by=(select auth.uid()));
create policy update_own on public.resources for update to authenticated using (created_by=(select auth.uid()) or (select public.is_admin())) with check (created_by=(select auth.uid()) or (select public.is_admin()));
create policy delete_own on public.resources for delete to authenticated using (created_by=(select auth.uid()) or (select public.is_admin()));

-- Atomic multi-record editor saves. SECURITY INVOKER preserves RLS.
-- Compare the original row under lock to reject stale editors instead of losing updates.
create function public.apply_community_changes(changes jsonb) returns void language plpgsql security invoker set search_path = '' as $$
declare c jsonb; t text; fields text; assignments text; current_row jsonb; affected integer;
begin
 if auth.uid() is null then raise exception 'Cần đăng nhập' using errcode='42501'; end if;
 if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes)>10000 then raise exception 'Danh sách thay đổi không hợp lệ'; end if;
 for c in select value from jsonb_array_elements(changes) loop
  t:=c->>'table';
  case t
  when 'activity_nodes' then fields := 'id,created_by,parent_id,title,description,kind,enabled'; assignments := '(parent_id,title,description,kind,enabled) = (select parent_id,title,description,kind,enabled from jsonb_populate_record(null::public.activity_nodes, $1))';
  when 'activity_variants' then fields := 'id,created_by,node_id,title,description'; assignments := '(node_id,title,description) = (select node_id,title,description from jsonb_populate_record(null::public.activity_variants, $1))';
  when 'resources' then fields := 'id,created_by,node_id,variant_id,title,type,url,content'; assignments := '(node_id,variant_id,title,type,url,content) = (select node_id,variant_id,title,type,url,content from jsonb_populate_record(null::public.resources, $1))';
  else raise exception 'Bảng không hợp lệ'; end case;
  if c->>'op' in ('update','delete') then
   execute format('select to_jsonb(r) from public.%I r where id=$1 for update',t) into current_row using (c->'data'->>'id')::uuid;
   if current_row is null or c->'before' is null or not (current_row @> (c->'before')) then
    raise exception 'Nội dung đã thay đổi; tải lại trước khi lưu' using errcode='40001';
   end if;
  end if;
  case c->>'op'
  when 'insert' then
   execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1)',t,fields,fields,t) using c->'data';
  when 'update' then
   execute format('update public.%I set %s where id=$2',t,assignments) using c->'data',(c->'data'->>'id')::uuid;
  when 'delete' then
   execute format('delete from public.%I where id=$1',t) using (c->'data'->>'id')::uuid;
  else raise exception 'Thao tác không hợp lệ'; end case;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Không có quyền hoặc dữ liệu đã thay đổi' using errcode='40001'; end if;
 end loop;
end; $$;
revoke all on function public.apply_community_changes(jsonb) from public, anon;
grant execute on function public.apply_community_changes(jsonb) to authenticated;
-- Initial admin is bootstrapped by trusted SQL; subsequent role changes require a current admin.
create function public.set_member_role(target_user uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(72819401);
 if not public.is_admin() then raise exception 'Chỉ Admin được quản lý quyền' using errcode='42501'; end if;
 if new_role not in ('member','admin') or new_role is null then raise exception 'Vai trò không hợp lệ'; end if;
 if not exists(select 1 from public.profiles where id=target_user) then raise exception 'Không tìm thấy thành viên'; end if;
 if new_role='member' and exists(select 1 from public.profiles where id=target_user and role='admin')
   and (select count(*) from public.profiles where role='admin') <= 1 then
   raise exception 'Không thể hạ quyền Admin cuối cùng';
 end if;
 update public.profiles set role=new_role where id=target_user;
end; $$;
revoke all on function public.set_member_role(uuid,text) from public,anon;
grant execute on function public.set_member_role(uuid,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('activity-images','activity-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']);
create policy activity_images_read on storage.objects for select to anon,authenticated using (bucket_id='activity-images');
create policy activity_images_insert on storage.objects for insert to authenticated with check (
 bucket_id='activity-images' and (storage.foldername(name))[1]=(select auth.uid())::text and owner_id=(select auth.uid())::text
);
-- No UPDATE/upsert policy: images are immutable; replacement uploads a fresh path.
create policy activity_images_delete on storage.objects for delete to authenticated using (
 bucket_id='activity-images' and (owner_id=(select auth.uid())::text or (select public.is_admin()))
);
commit;
