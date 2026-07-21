create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Служитель',
  notification_offset_minutes integer not null default 1440,
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists notification_offset_minutes integer not null default 1440;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  service_time time not null,
  title text not null,
  note text not null default 'Без опису',
  roles text[] not null default array[]::text[],
  is_recurring boolean not null default false,
  recurring_parent_id uuid,
  reminder_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists services_recurring_slot_idx
on public.services (recurring_parent_id, service_date, service_time)
where recurring_parent_id is not null;

create table if not exists public.response_options (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  role text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  unique (service_id, role, user_id)
);

create table if not exists public.service_assignments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  role text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  assigned_at timestamptz not null default now(),
  reminder_sent_at timestamptz,
  unique (service_id, role)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id integer primary key default 1,
  notification_offset_minutes integer not null default 1440,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into public.app_settings (id, notification_offset_minutes)
select 1, 1440
where not exists (select 1 from public.app_settings);

insert into public.response_options (label, position)
select label, position
from (
  values
    ('Можу бути', 1),
    ('Не можу бути', 2),
    ('Під питанням', 3)
) as seed(label, position)
where not exists (select 1 from public.response_options);

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.response_options enable row level security;
alter table public.responses enable row level security;
alter table public.service_assignments enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "profiles read authenticated" on public.profiles;
create policy "profiles read authenticated"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles upsert own" on public.profiles;
create policy "profiles upsert own"
on public.profiles for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "services read authenticated" on public.services;
create policy "services read authenticated"
on public.services for select
to authenticated
using (true);

drop policy if exists "services write authenticated" on public.services;
create policy "services write authenticated"
on public.services for all
to authenticated
using (true)
with check (true);

drop policy if exists "response options read authenticated" on public.response_options;
create policy "response options read authenticated"
on public.response_options for select
to authenticated
using (true);

drop policy if exists "response options write authenticated" on public.response_options;
create policy "response options write authenticated"
on public.response_options for all
to authenticated
using (true)
with check (true);

drop policy if exists "responses read authenticated" on public.responses;
create policy "responses read authenticated"
on public.responses for select
to authenticated
using (true);

drop policy if exists "responses write authenticated" on public.responses;
create policy "responses write authenticated"
on public.responses for all
to authenticated
using (true)
with check (true);

drop policy if exists "service assignments read authenticated" on public.service_assignments;
create policy "service assignments read authenticated"
on public.service_assignments for select
to authenticated
using (true);

drop policy if exists "service assignments write authenticated" on public.service_assignments;
create policy "service assignments write authenticated"
on public.service_assignments for all
to authenticated
using (true)
with check (true);

drop policy if exists "push subscriptions own" on public.push_subscriptions;
create policy "push subscriptions own"
on public.push_subscriptions for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "app settings read authenticated" on public.app_settings;
create policy "app settings read authenticated"
on public.app_settings for select
to authenticated
using (true);

drop policy if exists "app settings write authenticated" on public.app_settings;
create policy "app settings write authenticated"
on public.app_settings for all
to authenticated
using (true)
with check (true);

do $$
begin
  alter publication supabase_realtime add table public.services;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.response_options;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.responses;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.service_assignments;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.app_settings;
exception
  when duplicate_object then null;
end $$;
