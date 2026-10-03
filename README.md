# FitTrack

Track workouts and diet, see your progress, and chat with an AI coach that knows your numbers.

**Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · Supabase (Postgres + Auth) · Firebase Analytics

## What's in this boilerplate

- **Tailwind theme** with `primary` (green) and `secondary` (orange) scales, 50–950, in `src/app/globals.css`.
  Use them like `bg-primary-600`, `text-secondary-500`, `border-primary-200`.
- **Supabase auth**: email + password sign up / log in / sign out, email confirmation route,
  session refresh in `src/proxy.ts`, and a protected `/dashboard`.
- **Firebase Analytics**: automatic `page_view` on every route change, user id set on login,
  and a typed `track()` helper for custom events (`login`, `sign_up`, `logout` already wired).
- **Database schema** with Row Level Security in `supabase/migrations/0001_init.sql`
  (profiles, workouts, workout sets, diet entries, goals, chat messages).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000.

### 1. Supabase

1. Create a project at https://supabase.com.
2. **Project Settings → API**: copy the URL and the publishable (or anon) key into `.env.local`.
3. **SQL Editor**: paste and run `supabase/migrations/0001_init.sql`.
4. **Authentication → URL Configuration**: set Site URL to `http://localhost:3000`
   and add `http://localhost:3000/auth/confirm` to Redirect URLs (add your production URL later).

Email confirmation is on by default, so new users get a confirmation email before they can log in.

### 2. Firebase Analytics

1. Create a project at https://console.firebase.google.com and enable Google Analytics.
2. **Project settings → Your apps → Add app → Web**, then copy the config values into `.env.local`.
   `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (starts with `G-`) is required.
3. Events show up in **Analytics → DebugView / Realtime** in the Firebase console.

If the Firebase variables are missing, analytics silently does nothing, so the app still runs.

## Logging an event

```ts
import { track } from "@/lib/firebase/analytics";

track("workout_logged", { exercise_count: 5, duration_min: 45 });
```

Add new event names and their parameters to the `AppEvents` type in `src/lib/firebase/analytics.ts`.

## Project layout

```
src/
  proxy.ts                       session refresh + route protection
  app/
    page.tsx                     landing page
    login/                       auth form + server actions
    auth/confirm/route.ts        email confirmation handler
    dashboard/page.tsx           protected page
  components/
    analytics-provider.tsx       page views + user id
    sign-out-button.tsx
  lib/
    supabase/{client,server,proxy}.ts
    firebase/{client,analytics}.ts
supabase/migrations/0001_init.sql
```

## Next up

- Workout logging and diet tracking screens
- Progress dashboard with charts
- AI chat using the user's own OpenAI key (stored encrypted, used server-side only)
- Strava and Google Fit sync
- Goals, streaks and reminders
