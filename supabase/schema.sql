-- FitFlow database schema. Run in the Supabase SQL editor.
create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  age integer, height numeric, weight numeric, target_weight numeric,
  goal text, experience text, frequency integer,
  equipment text[] default '{}', injuries text,
  avatar_url text, updated_at timestamptz default now()
);
create table public.exercises (
  id text primary key, name text not null, muscle text not null,
  secondary text[] default '{}', equipment text not null, type text not null,
  difficulty text not null, instructions jsonb not null default '[]',
  safety text, illustration_url text
);
create table public.routines (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, day text, focus text, duration integer, color text, created_at timestamptz default now()
);
create table public.routine_exercises (
  id uuid primary key default uuid_generate_v4(), routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id text not null references public.exercises(id), position integer not null default 0,
  sets integer not null, reps integer not null, rest integer not null, target_weight numeric default 0
);
create table public.workouts (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null, completed_at timestamptz default now(),
  duration integer, volume numeric default 0, completion integer default 0, personal_bests integer default 0
);
create table public.workout_sets (
  id uuid primary key default uuid_generate_v4(), workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id text not null references public.exercises(id), set_number integer not null, reps integer, weight numeric, completed boolean default false
);
create table public.body_measurements (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at date default current_date, weight numeric, chest numeric, waist numeric, hips numeric, arms numeric, thighs numeric
);
create table public.progress_photos (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at date default current_date, storage_path text not null, note text
);
-- Fast prototype sync layer. Normalized tables above remain the analytics-ready contract.
create table public.user_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}', routines jsonb not null default '[]',
  workouts jsonb not null default '[]', calories jsonb not null default '[]', onboarded boolean default false,
  state_version bigint not null default 0,
  updated_at timestamptz default now()
);
alter table public.user_states add column if not exists state_version bigint not null default 0;

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.user_states enable row level security;

create policy "Exercises are readable by authenticated users" on public.exercises for select to authenticated using (true);
create policy "Users own profiles" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users own routines" on public.routines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own routine exercises" on public.routine_exercises for all using (exists(select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())) with check (exists(select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()));
create policy "Users own workouts" on public.workouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own workout sets" on public.workout_sets for all using (exists(select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())) with check (exists(select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));
create policy "Users own measurements" on public.body_measurements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own progress photos" on public.progress_photos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own synced state" on public.user_states for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Active prototype persistence contract. Applies a write only when the caller's
-- expected version still matches, preventing silent last-write-wins data loss.
create or replace function public.compare_and_swap_user_state(
  expected_version bigint,
  next_profile jsonb,
  next_routines jsonb,
  next_workouts jsonb,
  next_calories jsonb,
  next_onboarded boolean
)
returns table(applied boolean, new_state_version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  written_version bigint;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.user_states (
    user_id, profile, routines, workouts, calories, onboarded, state_version, updated_at
  )
  select
    caller_id, next_profile, next_routines, next_workouts, next_calories, next_onboarded,
    expected_version + 1, now()
  where expected_version = 0
  on conflict (user_id) do update set
    profile = excluded.profile,
    routines = excluded.routines,
    workouts = excluded.workouts,
    calories = excluded.calories,
    onboarded = excluded.onboarded,
    state_version = excluded.state_version,
    updated_at = excluded.updated_at
  where public.user_states.state_version = expected_version
  returning public.user_states.state_version into written_version;

  if written_version is not null then
    return query select true, written_version;
  else
    return query
      select false, coalesce((
        select user_states.state_version
        from public.user_states
        where user_states.user_id = caller_id
      ), 0);
  end if;
end;
$$;

revoke all on function public.compare_and_swap_user_state(bigint, jsonb, jsonb, jsonb, jsonb, boolean) from public;
grant execute on function public.compare_and_swap_user_state(bigint, jsonb, jsonb, jsonb, jsonb, boolean) to authenticated;
