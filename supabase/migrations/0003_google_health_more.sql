-- More Google Health data: extra daily metrics, sleep, heart and tracked exercise sessions.
-- Run in Supabase: SQL Editor → paste → Run (or `supabase db push` with the CLI).

alter table public.daily_activity
  -- Activity (googlehealth.activity_and_fitness.readonly)
  add column floors integer,
  add column active_zone_minutes integer,
  add column active_kcal numeric,
  add column sedentary_min integer,
  -- Heart & body (googlehealth.health_metrics_and_measurements.readonly)
  add column resting_hr integer,
  add column hr_avg numeric,
  add column hr_min numeric,
  add column hr_max numeric,
  add column hrv_ms numeric,
  add column spo2_pct numeric,
  add column weight_kg numeric,
  -- Sleep (googlehealth.sleep.readonly), stored on the day the user woke up
  add column sleep_min integer,
  add column sleep_deep_min integer,
  add column sleep_light_min integer,
  add column sleep_rem_min integer,
  add column sleep_awake_min integer,
  add column sleep_start timestamptz,
  add column sleep_end timestamptz;

-- Exercise sessions recorded by the user's phone or watch.
create table public.synced_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null default 'google_health' check (source in ('google_health')),
  external_id text not null,
  exercise_type text,
  display_name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  active_duration_s integer,
  calories_kcal numeric,
  distance_m numeric,
  steps integer,
  avg_hr integer,
  active_zone_minutes integer,
  synced_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table public.synced_exercises enable row level security;
create policy "own rows" on public.synced_exercises for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index on public.synced_exercises (user_id, started_at desc);
