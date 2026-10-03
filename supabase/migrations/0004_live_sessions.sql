-- Live sessions: train "together" with a friend in another gym.
-- Run in Supabase: SQL Editor → paste → Run (or `supabase db push` with the CLI).
--
-- Only members of a session can see it, its members and its sets (RLS). People join
-- through a share code via join_live_session(), never by inserting rows directly.

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  -- 8-character share code, e.g. 7F3K9QAZ
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  host_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '6 hours'
);

create table public.live_session_members (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table public.live_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise text not null check (char_length(exercise) between 1 and 80),
  set_number integer not null check (set_number between 1 and 50),
  reps integer check (reps between 0 and 1000),
  weight_kg numeric check (weight_kg between 0 and 1000),
  created_at timestamptz not null default now()
);

create index on public.live_sets (session_id, created_at);
create index on public.live_session_members (user_id);

-- Membership check used by the policies. SECURITY DEFINER avoids the policy on
-- live_session_members recursively checking itself.
create function public.is_live_member(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.live_session_members m
    where m.session_id = sid and m.user_id = (select auth.uid())
  );
$$;

alter table public.live_sessions enable row level security;
alter table public.live_session_members enable row level security;
alter table public.live_sets enable row level security;

create policy "members read session" on public.live_sessions for select to authenticated
  using (public.is_live_member(id));
create policy "host ends session" on public.live_sessions for update to authenticated
  using ((select auth.uid()) = host_id)
  with check ((select auth.uid()) = host_id);

create policy "members read members" on public.live_session_members for select to authenticated
  using (public.is_live_member(session_id));
create policy "leave session" on public.live_session_members for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "members read sets" on public.live_sets for select to authenticated
  using (public.is_live_member(session_id));
create policy "members add own sets to active session" on public.live_sets for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_live_member(session_id)
    and exists (select 1 from public.live_sessions s where s.id = session_id and s.expires_at > now())
  );
create policy "delete own sets" on public.live_sets for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Starts a session with the caller as host and first member. Returns the share code.
create function public.create_live_session(display_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  share_code text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into public.live_sessions (host_id) values (uid) returning id, code into sid, share_code;
  insert into public.live_session_members (session_id, user_id, display_name)
    values (sid, uid, left(coalesce(nullif(trim(display_name), ''), 'Friend'), 40));
  return share_code;
end;
$$;

-- Host name and status for an invite link, so the join page can say whose session it is
-- before the visitor is a member. Reveals nothing else.
create function public.live_session_preview(share_code text)
returns table (host_name text, member_count integer, active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select m.display_name from public.live_session_members m where m.session_id = s.id and m.user_id = s.host_id),
    (select count(*)::integer from public.live_session_members m where m.session_id = s.id),
    s.expires_at > now()
  from public.live_sessions s
  where s.code = upper(trim(share_code));
$$;

-- Joins an active session by its share code (max 6 people). Returns the session id.
create function public.join_live_session(share_code text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select id into sid from public.live_sessions
    where code = upper(trim(share_code)) and expires_at > now();
  if sid is null then raise exception 'session not found or ended'; end if;
  if not exists (select 1 from public.live_session_members where session_id = sid and user_id = uid)
     and (select count(*) from public.live_session_members where session_id = sid) >= 6 then
    raise exception 'session is full';
  end if;
  insert into public.live_session_members (session_id, user_id, display_name)
    values (sid, uid, left(coalesce(nullif(trim(display_name), ''), 'Friend'), 40))
    on conflict (session_id, user_id) do nothing;
  return sid;
end;
$$;

revoke execute on function public.create_live_session(text) from public, anon;
revoke execute on function public.join_live_session(text, text) from public, anon;
revoke execute on function public.live_session_preview(text) from public, anon;
revoke execute on function public.is_live_member(uuid) from public, anon;
grant execute on function public.create_live_session(text) to authenticated;
grant execute on function public.join_live_session(text, text) to authenticated;
grant execute on function public.live_session_preview(text) to authenticated;
grant execute on function public.is_live_member(uuid) to authenticated;

-- Stream new sets and members to subscribed members (Realtime applies the RLS above).
alter publication supabase_realtime add table public.live_sets, public.live_session_members;
