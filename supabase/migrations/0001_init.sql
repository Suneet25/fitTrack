-- FitTrack initial schema.
-- Run in Supabase: SQL Editor → paste → Run (or `supabase db push` with the CLI).
-- Every table is protected by Row Level Security: users only see their own rows.

-- Profiles (1:1 with auth.users) -------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  height_cm numeric,
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Workouts ------------------------------------------------------------------
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_at timestamptz not null default now(),
  title text,
  duration_min integer,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'strava', 'google_fit')),
  external_id text,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise text not null,
  set_number integer not null,
  reps integer,
  weight_kg numeric,
  created_at timestamptz not null default now()
);

-- Diet ----------------------------------------------------------------------
create table public.diet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food text not null,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz not null default now()
);

-- Goals ---------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_type text not null, -- e.g. 'target_weight', 'weekly_workouts'
  target_value numeric not null,
  deadline date,
  created_at timestamptz not null default now()
);

-- AI chat history -----------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Row Level Security --------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['workouts', 'workout_sets', 'diet_entries', 'goals', 'chat_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Helpful indexes
create index on public.workouts (user_id, performed_at desc);
create index on public.workout_sets (workout_id);
create index on public.diet_entries (user_id, eaten_at desc);
create index on public.chat_messages (user_id, created_at);

-- Note: the user's own OpenAI API key and Strava / Google Fit tokens will get
-- their own table in a later migration, encrypted and readable server-side only.
