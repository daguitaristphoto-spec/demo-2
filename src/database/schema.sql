create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'judge');
create type public.sheet_status as enum ('draft', 'submitted');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contestants (
  id uuid primary key default gen_random_uuid(),
  sbd text not null unique,
  full_name text not null,
  profile_text text,
  portrait_url text,
  video_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid not null unique references public.contestants(id) on delete cascade,
  judge_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  can_edit boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.score_sheets (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid not null references public.contestants(id) on delete cascade,
  judge_id uuid not null references public.profiles(id) on delete restrict,
  strengths text,
  weaknesses text,
  total_score numeric(5,2) not null default 0,
  status public.sheet_status not null default 'draft',
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (contestant_id, judge_id)
);

create table if not exists public.score_items (
  id uuid primary key default gen_random_uuid(),
  score_sheet_id uuid not null references public.score_sheets(id) on delete cascade,
  criterion_key text not null,
  criterion_group text not null,
  score numeric(4,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (score_sheet_id, criterion_key)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_assignments_updated
before update on public.assignments
for each row execute function public.set_updated_at();

create trigger trg_score_sheets_updated
before update on public.score_sheets
for each row execute function public.set_updated_at();

create trigger trg_score_items_updated
before update on public.score_items
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.contestants enable row level security;
alter table public.assignments enable row level security;
alter table public.score_sheets enable row level security;
alter table public.score_items enable row level security;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- profiles
create policy "profiles_select_self_or_admin"
on public.profiles
for select
using (
  id = auth.uid()
  or public.current_app_role() = 'admin'
);

create policy "profiles_admin_manage"
on public.profiles
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

-- contestants
create policy "contestants_admin_all"
on public.contestants
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "contestants_judge_select_assigned"
on public.contestants
for select
using (
  exists (
    select 1
    from public.assignments a
    where a.contestant_id = contestants.id
      and a.judge_id = auth.uid()
  )
);

-- assignments
create policy "assignments_admin_all"
on public.assignments
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "assignments_judge_select_own"
on public.assignments
for select
using (judge_id = auth.uid());

-- score sheets
create policy "score_sheets_admin_all"
on public.score_sheets
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "score_sheets_judge_select_own"
on public.score_sheets
for select
using (judge_id = auth.uid());

create policy "score_sheets_judge_insert_own"
on public.score_sheets
for insert
with check (
  judge_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    where a.contestant_id = score_sheets.contestant_id
      and a.judge_id = auth.uid()
      and a.can_edit = true
  )
);

create policy "score_sheets_judge_update_when_editable"
on public.score_sheets
for update
using (
  judge_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    where a.contestant_id = score_sheets.contestant_id
      and a.judge_id = auth.uid()
      and a.can_edit = true
  )
)
with check (
  judge_id = auth.uid()
);

-- score items
create policy "score_items_admin_all"
on public.score_items
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "score_items_judge_select_own"
on public.score_items
for select
using (
  exists (
    select 1
    from public.score_sheets s
    where s.id = score_items.score_sheet_id
      and s.judge_id = auth.uid()
  )
);

create policy "score_items_judge_insert_own_when_editable"
on public.score_items
for insert
with check (
  exists (
    select 1
    from public.score_sheets s
    join public.assignments a on a.contestant_id = s.contestant_id and a.judge_id = s.judge_id
    where s.id = score_items.score_sheet_id
      and s.judge_id = auth.uid()
      and a.can_edit = true
  )
);

create policy "score_items_judge_update_own_when_editable"
on public.score_items
for update
using (
  exists (
    select 1
    from public.score_sheets s
    join public.assignments a on a.contestant_id = s.contestant_id and a.judge_id = s.judge_id
    where s.id = score_items.score_sheet_id
      and s.judge_id = auth.uid()
      and a.can_edit = true
  )
)
with check (true);

-- Storage policies are best created from the dashboard if needed.
