/**
 * App-wide constants that change with a code deploy. Values that should change
 * without a deploy live in Remote Config instead (src/config/remote-config.ts).
 */

const isDev = process.env.NODE_ENV === "development";

export const APP = {
  name: "FitTrack",
  description: "Track workouts and diet, and chat with an AI coach about your progress.",
} as const;

export const GOOGLE_HEALTH = {
  /** heart-rate and total-calories rollups are capped at 14 days, so daily metrics share that window. */
  syncDays: 14,
  /** Exercise sessions are listed (not rolled up), so they can look further back. */
  exerciseDays: 30,
} as const;

export const REMOTE_CONFIG_SETTINGS = {
  /** How long the server caches the published template before fetching it again. */
  serverRevalidateSeconds: 60,
  /** A slow Remote Config call must never hold up a page render; defaults are used instead. */
  serverTimeoutMs: 1500,
  /** Minimum time between client fetches (the SDK caches in IndexedDB in between). */
  clientMinFetchIntervalMs: isDev ? 60_000 : 60 * 60_000,
  clientFetchTimeoutMs: 5000,
} as const;
