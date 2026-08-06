-- Kepli schema — §6 of REQUIREMENTS.md
--
-- Run once in the Supabase SQL Editor. Safe to re-run: every statement is guarded.
--
-- RLS is on for every table. Two shapes of policy:
--   - Tables with user_id  -> auth.uid() = user_id
--   - milestones, commitments (no user_id, per §6) -> scoped through goals.goal_id
--
-- `waitlist` already exists from the earlier migration and is deliberately not
-- touched here: it is insert-only with no select policy.

-- ---------------------------------------------------------------- tables ----

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  why text not null,
  deadline date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null,
  target_date date not null,
  -- Mirrors the MilestoneStatus union in types/index.ts.
  status text not null default 'pending'
    check (status in ('pending', 'hit', 'missed'))
);

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null,
  -- v1 ships weekly only; the column exists so adding daily/monthly needs no migration.
  cadence text not null default 'weekly' check (cadence in ('weekly')),
  target_per_week integer not null check (target_per_week between 1 and 7)
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  note text not null default '',
  commitments_hit jsonb not null default '{}'::jsonb,
  points integer not null default 0,
  score integer not null default 0,
  -- One check-in per user per day. Editing today's entry updates this row rather
  -- than creating a second one.
  unique (user_id, date)
);

create table if not exists public.drift_checks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  date date not null,
  verdict text not null,
  gap_analysis text not null,
  pace_math jsonb not null default '{}'::jsonb
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  week_start date not null,
  summary text not null,
  verdict text not null,
  unique (goal_id, week_start)
);

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  definition text not null,
  -- One floor per user — §F8 describes a single worst-day minimum.
  unique (user_id)
);

-- --------------------------------------------------------------- indexes ----

create index if not exists goals_user_id_idx on public.goals (user_id);
create index if not exists milestones_goal_id_idx on public.milestones (goal_id);
create index if not exists commitments_goal_id_idx on public.commitments (goal_id);
create index if not exists checkins_user_id_date_idx on public.checkins (user_id, date desc);
create index if not exists drift_checks_goal_id_idx on public.drift_checks (goal_id);
create index if not exists reviews_goal_id_idx on public.reviews (goal_id);

-- ------------------------------------------------------------------- RLS ----

alter table public.goals enable row level security;
alter table public.milestones enable row level security;
alter table public.commitments enable row level security;
alter table public.checkins enable row level security;
alter table public.drift_checks enable row level security;
alter table public.reviews enable row level security;
alter table public.floors enable row level security;

-- Policies are dropped first so this file can be re-run after an edit.

-- Tables owning user_id directly.

drop policy if exists "own goals" on public.goals;
create policy "own goals" on public.goals
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own checkins" on public.checkins;
create policy "own checkins" on public.checkins
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own floors" on public.floors;
create policy "own floors" on public.floors
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tables scoped through goals. `using` governs reads and which rows may be changed;
-- `with check` governs the post-write state. Both are required — omitting the second
-- would let a user move their own row onto someone else's goal.

drop policy if exists "own milestones" on public.milestones;
create policy "own milestones" on public.milestones
  for all to authenticated
  using (
    exists (
      select 1 from public.goals
      where goals.id = milestones.goal_id and goals.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.goals
      where goals.id = milestones.goal_id and goals.user_id = auth.uid()
    )
  );

drop policy if exists "own commitments" on public.commitments;
create policy "own commitments" on public.commitments
  for all to authenticated
  using (
    exists (
      select 1 from public.goals
      where goals.id = commitments.goal_id and goals.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.goals
      where goals.id = commitments.goal_id and goals.user_id = auth.uid()
    )
  );

drop policy if exists "own drift_checks" on public.drift_checks;
create policy "own drift_checks" on public.drift_checks
  for all to authenticated
  using (
    exists (
      select 1 from public.goals
      where goals.id = drift_checks.goal_id and goals.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.goals
      where goals.id = drift_checks.goal_id and goals.user_id = auth.uid()
    )
  );

drop policy if exists "own reviews" on public.reviews;
create policy "own reviews" on public.reviews
  for all to authenticated
  using (
    exists (
      select 1 from public.goals
      where goals.id = reviews.goal_id and goals.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.goals
      where goals.id = reviews.goal_id and goals.user_id = auth.uid()
    )
  );

-- ------------------------------------------------- atomic goal creation ----

-- Creates a goal with its milestones and commitments in one transaction. A function
-- body is a single transaction, so a failure part-way rolls back the goal too and an
-- orphaned goal with no plan is impossible.
--
-- SECURITY INVOKER (the default) is deliberate: the function runs as the calling
-- user, so the RLS policies above still apply to every insert inside it.

create or replace function public.create_goal_with_plan(
  p_title text,
  p_why text,
  p_deadline date,
  p_milestones jsonb default '[]'::jsonb,
  p_commitments jsonb default '[]'::jsonb
)
returns public.goals
language plpgsql
as $$
declare
  v_goal public.goals;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  insert into public.goals (user_id, title, why, deadline)
  values (auth.uid(), p_title, p_why, p_deadline)
  returning * into v_goal;

  insert into public.milestones (goal_id, title, target_date)
  select v_goal.id, item ->> 'title', (item ->> 'target_date')::date
  from jsonb_array_elements(p_milestones) as item;

  insert into public.commitments (goal_id, title, target_per_week)
  select v_goal.id, item ->> 'title', (item ->> 'target_per_week')::integer
  from jsonb_array_elements(p_commitments) as item;

  return v_goal;
end;
$$;
