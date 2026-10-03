-- Google Health API link + synced daily activity.
-- Run in Supabase: SQL Editor → paste → Run (or `supabase db push` with the CLI).

-- One Google Health link per user. The refresh token is AES-256-GCM encrypted
-- by the Next.js server (GOOGLE_TOKEN_ENCRYPTION_KEY), so the stored value is
-- useless without the server secret.
create table public.google_health_connections (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  refresh_token_enc text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_error text
);

-- One row per user per day per source.
create table public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  source text not null default 'google_health' check (source in ('google_health')),
  steps integer,
  distance_m numeric,
  calories_kcal numeric,
  synced_at timestamptz not null default now(),
  unique (user_id, source, day)
);

alter table public.google_health_connections enable row level security;
create policy "own row" on public.google_health_connections for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.daily_activity enable row level security;
create policy "own rows" on public.daily_activity for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index on public.daily_activity (user_id, day desc);
