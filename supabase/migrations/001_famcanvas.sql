-- Apply once in a fresh Supabase project via the SQL editor or supabase db push.
begin;
create extension if not exists pgcrypto;

create table public.families (
  id uuid primary key default gen_random_uuid(), name text not null default 'Our family' check (length(name) between 1 and 100),
  plan_type text not null default 'free' check (plan_type in ('free','premium')),
  stripe_customer_id text unique, stripe_subscription_id text unique, stripe_event_created bigint not null default 0,
  created_at timestamptz not null default now()
);
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade, email text not null,
  full_name text not null check (length(full_name) between 1 and 100),
  family_id uuid not null references public.families(id), role text not null default 'member' check (role in ('parent','child','member')),
  created_at timestamptz not null default now()
);
create table public.canvas_items (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade, type text not null check (type in ('photo','note','voice','sticker')),
  content_url text, text_content text check (length(text_content) <= 2000),
  position_x double precision not null default 0 check (position_x between 0 and 10000),
  position_y double precision not null default 0 check (position_y between 0 and 10000),
  color text not null default 'yellow' check (color in ('yellow','pink','green','lavender')),
  created_at timestamptz not null default now(),
  check ((type in ('photo','voice') and content_url is not null) or type in ('note','sticker'))
);
create table public.storybooks (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade,
  title text not null default 'Your family story', story_json jsonb not null default '{}', audio_url text,
  status text not null default 'generating' check (status in ('generating','complete')),
  created_at timestamptz not null default now()
);
create table public.notification_settings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.users(id) on delete cascade,
  evening_nudge_enabled boolean not null default false, preferred_time time not null default '19:30',
  timezone text not null default 'UTC', push_token text
);
create table public.family_invites (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(), role text not null default 'member' check (role in ('member','child')),
  expires_at timestamptz not null default now() + interval '7 days', used_at timestamptz
);
create table public.family_usage (
  family_id uuid not null references public.families(id) on delete cascade, month date not null,
  photos integer not null default 0, stories integer not null default 0, primary key (family_id,month)
);
create table public.notification_deliveries (
  user_id uuid not null references public.users(id) on delete cascade, local_date date not null,
  sent_at timestamptz, created_at timestamptz not null default now(), primary key (user_id,local_date)
);
create index canvas_family_date on public.canvas_items(family_id,created_at);
create index story_family_date on public.storybooks(family_id,created_at);
create index users_family on public.users(family_id);

-- Definer helpers avoid recursively querying the users RLS policy.
create function public.my_family_id() returns uuid language sql stable security definer set search_path = '' as $$ select family_id from public.users where id = auth.uid() $$;
create function public.is_family_parent() returns boolean language sql stable security definer set search_path = '' as $$ select coalesce((select role = 'parent' from public.users where id = auth.uid()),false) $$;
revoke all on function public.my_family_id(), public.is_family_parent() from public;
grant execute on function public.my_family_id(), public.is_family_parent() to authenticated;

alter table public.families enable row level security;
alter table public.users enable row level security;
alter table public.canvas_items enable row level security;
alter table public.storybooks enable row level security;
alter table public.notification_settings enable row level security;
alter table public.family_invites enable row level security;
alter table public.family_usage enable row level security;
alter table public.notification_deliveries enable row level security;

create policy family_read on public.families for select to authenticated using (id = public.my_family_id());
create policy member_read on public.users for select to authenticated using (family_id = public.my_family_id());
create policy profile_update on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy canvas_read on public.canvas_items for select to authenticated using (family_id = public.my_family_id());
create policy canvas_insert on public.canvas_items for insert to authenticated with check (family_id = public.my_family_id() and user_id = auth.uid());
create policy canvas_move on public.canvas_items for update to authenticated using (family_id = public.my_family_id()) with check (family_id = public.my_family_id());
create policy canvas_delete on public.canvas_items for delete to authenticated using (family_id = public.my_family_id() and (user_id = auth.uid() or public.is_family_parent()));
create policy story_read on public.storybooks for select to authenticated using (family_id = public.my_family_id());
create policy settings_read on public.notification_settings for select to authenticated using (user_id = auth.uid());
create policy settings_insert on public.notification_settings for insert to authenticated with check (user_id = auth.uid());
create policy settings_update on public.notification_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy usage_read on public.family_usage for select to authenticated using (family_id = public.my_family_id());

-- Restrict column writes as well as row access. Clients cannot change plans, roles,
-- ownership, timestamps, or story output even by bypassing the UI.
revoke all on public.families, public.users, public.canvas_items, public.storybooks, public.notification_settings, public.family_invites, public.family_usage, public.notification_deliveries from anon, authenticated;
grant select on public.families, public.users, public.canvas_items, public.storybooks, public.notification_settings, public.family_usage to authenticated;
grant update(full_name) on public.users to authenticated;
grant insert(id,family_id,user_id,type,content_url,text_content,position_x,position_y,color) on public.canvas_items to authenticated;
grant update(position_x,position_y) on public.canvas_items to authenticated;
grant delete on public.canvas_items to authenticated;
grant insert(user_id,evening_nudge_enabled,preferred_time,timezone,push_token) on public.notification_settings to authenticated;
grant update(user_id,evening_nudge_enabled,preferred_time,timezone,push_token) on public.notification_settings to authenticated;
grant all on all tables in schema public to service_role;

create function public.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
declare fid uuid; display_name text;
begin
  display_name := left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1),'Family member'),80);
  insert into public.families(name) values (display_name || '''s family') returning id into fid;
  insert into public.users(id,email,full_name,family_id,role) values (new.id,coalesce(new.email,''),display_name,fid,'parent');
  insert into public.notification_settings(user_id) values (new.id);
  return new;
end $$;
create trigger auth_user_created after insert on auth.users for each row execute function public.on_signup();
revoke all on function public.on_signup() from public, anon, authenticated;

create function public.validate_canvas_insert() returns trigger language plpgsql security definer set search_path = '' as $$
declare plan text; used integer; current_month date := date_trunc('month',now() at time zone 'UTC')::date;
begin
  -- Serialize all inserts for this family, enforcing quotas under concurrency.
  select plan_type into plan from public.families where id = new.family_id for update;
  if not exists(select 1 from public.users where id = new.user_id and family_id = new.family_id) then raise exception 'Invalid family member'; end if;
  new.created_at := now();
  if new.type in ('photo','voice') and (new.content_url not like new.family_id::text || '/' || new.user_id::text || '/%' or new.content_url like '%..%') then raise exception 'Media must belong to this family and uploader'; end if;
  if new.type = 'voice' and plan <> 'premium' then raise exception 'Voice memories require Family Premium'; end if;
  insert into public.family_usage(family_id,month) values (new.family_id,current_month) on conflict do nothing;
  if new.type = 'photo' then
    select photos into used from public.family_usage where family_id = new.family_id and month = current_month;
    if plan = 'free' and used >= 10 then raise exception 'Your free plan includes 10 photos per month. Upgrade for unlimited memories.'; end if;
    update public.family_usage set photos = photos + 1 where family_id = new.family_id and month = current_month;
  end if;
  return new;
end $$;
create trigger enforce_canvas_quota before insert on public.canvas_items for each row execute function public.validate_canvas_insert();
revoke all on function public.validate_canvas_insert() from public, anon, authenticated;

create function public.reserve_storybook() returns uuid language plpgsql security definer set search_path = '' as $$
declare fid uuid := public.my_family_id(); plan text; used integer; sid uuid; current_month date := date_trunc('month',now() at time zone 'UTC')::date;
begin
  if fid is null then raise exception 'Sign in to your family first'; end if;
  select plan_type into plan from public.families where id = fid for update;
  -- Release crashed generations after 10 minutes. A normal generation has a 5-minute route timeout.
  delete from public.storybooks where family_id = fid and status = 'generating' and created_at < now() - interval '10 minutes';
  if exists(select 1 from public.storybooks where family_id = fid and created_at > now() - interval '1 minute') then raise exception 'Please wait a minute before creating another story'; end if;
  if exists(select 1 from public.storybooks where family_id = fid and status = 'generating') then raise exception 'A family story is already being created'; end if;
  insert into public.family_usage(family_id,month) values (fid,current_month) on conflict do nothing;
  select stories into used from public.family_usage where family_id = fid and month = current_month;
  if plan = 'free' and used >= 1 then raise exception 'Your free plan includes 1 storybook per month. Upgrade for unlimited stories.'; end if;
  insert into public.storybooks(family_id) values (fid) returning id into sid;
  update public.family_usage set stories = stories + 1 where family_id = fid and month = current_month;
  return sid;
end $$;
create function public.refund_failed_story() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'generating' then update public.family_usage set stories = greatest(0,stories - 1) where family_id = old.family_id and month = date_trunc('month',old.created_at at time zone 'UTC')::date; end if;
  return old;
end $$;
create trigger refund_story_reservation after delete on public.storybooks for each row execute function public.refund_failed_story();
revoke all on function public.reserve_storybook(), public.refund_failed_story() from public, anon, authenticated;
grant execute on function public.reserve_storybook() to authenticated;

create function public.create_family_invite(invite_role text default 'member') returns uuid language plpgsql security definer set search_path = '' as $$
declare code uuid; fid uuid := public.my_family_id();
begin
  if not public.is_family_parent() then raise exception 'Only parents can invite family members'; end if;
  if invite_role not in ('member','child') then raise exception 'Choose a member or child role'; end if;
  if (select count(*) from public.family_invites where family_id = fid and used_at is null and expires_at > now()) >= 20 then raise exception 'Your family already has 20 pending invitations'; end if;
  insert into public.family_invites(family_id,role) values (fid,invite_role) returning token into code; return code;
end $$;
create function public.join_family(invite_token uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.family_invites; uid uuid := auth.uid(); old_family uuid;
begin
  if uid is null then raise exception 'Sign in to join a family'; end if;
  select * into invitation from public.family_invites where token = invite_token and used_at is null and expires_at > now() for update;
  if not found then raise exception 'This invitation is invalid or has expired'; end if;
  select family_id into old_family from public.users where id = uid for update;
  if old_family = invitation.family_id then raise exception 'You already belong to this family'; end if;
  if exists(select 1 from public.users where family_id = old_family and id <> uid) or exists(select 1 from public.canvas_items where family_id = old_family) or exists(select 1 from public.storybooks where family_id = old_family) or exists(select 1 from public.families where id = old_family and stripe_customer_id is not null) then raise exception 'Only a new, empty family account can join another family'; end if;
  update public.users set family_id = invitation.family_id, role = invitation.role where id = uid;
  update public.family_invites set used_at = now() where id = invitation.id;
  delete from public.families where id = old_family;
  return invitation.family_id;
end $$;
revoke all on function public.create_family_invite(text), public.join_family(uuid) from public, anon, authenticated;
grant execute on function public.create_family_invite(text), public.join_family(uuid) to authenticated;

create function public.validate_notification_timezone() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_timezone_names where name = new.timezone) then raise exception 'Invalid timezone'; end if;
  return new;
end $$;
create trigger validate_timezone before insert or update on public.notification_settings for each row execute function public.validate_notification_timezone();

-- One private bucket. Store object paths, never public links, in content_url/audio_url.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('family-media','family-media',false,10485760,array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/webm','audio/ogg','audio/wav','audio/x-wav']) on conflict(id) do nothing;
create policy family_media_read on storage.objects for select to authenticated using (bucket_id = 'family-media' and (storage.foldername(name))[1] = public.my_family_id()::text);
create policy family_media_insert on storage.objects for insert to authenticated with check (bucket_id = 'family-media' and (storage.foldername(name))[1] = public.my_family_id()::text and (storage.foldername(name))[2] = auth.uid()::text and (lower(storage.extension(name)) in ('png','jpg','jpeg','webp') or exists(select 1 from public.families where id = public.my_family_id() and plan_type = 'premium')));
create policy family_media_delete on storage.objects for delete to authenticated using (bucket_id = 'family-media' and (storage.foldername(name))[1] = public.my_family_id()::text and (storage.foldername(name))[2] = auth.uid()::text);

alter publication supabase_realtime add table public.canvas_items, public.storybooks, public.families, public.users;
commit;
