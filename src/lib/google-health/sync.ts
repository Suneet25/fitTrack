import { GOOGLE_HEALTH } from "@/config/app";
import type { createClient } from "@/lib/supabase/server";
import { decrypt } from "./crypto";
import { grantedScopes, OAuthError, refreshAccessToken, type ScopeKey } from "./oauth";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const API = "https://health.googleapis.com/v4/users/me/dataTypes";

export const SYNC_DAYS = GOOGLE_HEALTH.syncDays;
const EXERCISE_DAYS = GOOGLE_HEALTH.exerciseDays;

// ---------------------------------------------------------------------------
// Types and parsing helpers. The API is JSON-encoded proto: int64 arrives as a
// string and Duration as "123.5s".

type CivilDate = { year: number; month: number; day: number };
type Int64 = string | number;

export type DailyMetrics = {
  steps: number | null;
  distance_m: number | null;
  calories_kcal: number | null;
  floors: number | null;
  active_zone_minutes: number | null;
  active_kcal: number | null;
  sedentary_min: number | null;
  resting_hr: number | null;
  hr_avg: number | null;
  hr_min: number | null;
  hr_max: number | null;
  hrv_ms: number | null;
  spo2_pct: number | null;
  weight_kg: number | null;
  sleep_min: number | null;
  sleep_deep_min: number | null;
  sleep_light_min: number | null;
  sleep_rem_min: number | null;
  sleep_awake_min: number | null;
  sleep_start: string | null;
  sleep_end: string | null;
};
type Column = keyof DailyMetrics;
type DayValues = Map<string, Partial<DailyMetrics>>;

function num(v: Int64 | undefined | null) {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function seconds(duration: string | undefined) {
  return duration ? num(duration.replace(/s$/, "")) : undefined;
}

function round(n: number | undefined, digits = 0) {
  if (n === undefined) return undefined;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function civil(d: Date): CivilDate {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function isoDay({ year, month, day }: CivilDate) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysBefore(end: Date, days: number) {
  const d = new Date(end);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export class SyncError extends Error {
  constructor(
    message: string,
    public needsReconnect = false,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// HTTP

/** Returns a valid access token (refreshing and saving it when it's about to expire) and the granted scopes. */
async function connection(supabase: Supabase, userId: string) {
  const { data: conn, error } = await supabase
    .from("google_health_connections")
    .select("refresh_token_enc, access_token, access_token_expires_at, scope")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new SyncError(error.message);
  if (!conn) throw new SyncError("Google Health isn't connected.", true);

  const scopes = grantedScopes(conn.scope);
  const expiresAt = conn.access_token_expires_at ? Date.parse(conn.access_token_expires_at) : 0;
  if (conn.access_token && expiresAt - Date.now() > 60_000) return { token: conn.access_token as string, scopes };

  try {
    const tokens = await refreshAccessToken(decrypt(conn.refresh_token_enc));
    await supabase
      .from("google_health_connections")
      .update({
        access_token: tokens.access_token,
        access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
      .eq("user_id", userId);
    return { token: tokens.access_token, scopes };
  } catch (e) {
    if (e instanceof OAuthError && e.code === "invalid_grant") {
      throw new SyncError("Google access was revoked or expired. Please reconnect.", true);
    }
    throw new SyncError(e instanceof Error ? e.message : "Couldn't refresh Google access.");
  }
}

async function call(token: string, dataType: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reasons: string[] = (json?.error?.details ?? []).map((d: { reason?: string }) => d.reason);
    if (reasons.includes("ACCOUNT_NOT_LINKED")) {
      throw new SyncError(
        "Your Google account isn't linked to Google Health yet. Open the Google Health app (formerly Fitbit) on your phone and sign in with this Google account, or move your existing Fitbit account to it, then press “Sync now”.",
      );
    }
    const message = json?.error?.message ?? `Google Health API error (${res.status})`;
    throw new SyncError(`${dataType}: ${message}`, res.status === 401);
  }
  return json;
}

type RollupPoint = { civilStartTime?: { date?: CivilDate } } & Record<string, unknown>;

async function dailyRollUp(token: string, dataType: string, start: Date, end: Date) {
  const json = await call(token, dataType, `${API}/${dataType}/dataPoints:dailyRollUp`, {
    method: "POST",
    body: JSON.stringify({
      range: { start: { date: civil(start) }, end: { date: civil(end) } },
      windowSizeDays: 1,
      // windowSizeDays × pageSize must stay within the data type's max range.
      pageSize: SYNC_DAYS,
    }),
  });
  return (json.rollupDataPoints ?? []) as RollupPoint[];
}

/** Lists raw data points matching an AIP-160 filter, following pagination. */
async function listPoints(token: string, dataType: string, filter: string) {
  const points: Record<string, unknown>[] = [];
  let pageToken = "";
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({ filter, pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const json = await call(token, dataType, `${API}/${dataType}/dataPoints?${params}`);
    points.push(...(json.dataPoints ?? []));
    pageToken = json.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return points;
}

// ---------------------------------------------------------------------------
// Daily sources. Each one fills some columns of daily_activity.

type Range = { start: Date; end: Date };
type DailySource = {
  name: string;
  scope: ScopeKey;
  columns: Column[];
  fetch: (token: string, range: Range) => Promise<DayValues>;
};

/** A dailyRollUp metric: one value set per civil day. */
function rollup<T>(
  dataType: string,
  scope: ScopeKey,
  field: string,
  read: (v: T) => Partial<DailyMetrics>,
): DailySource {
  const sample = read({} as T);
  return {
    name: dataType,
    scope,
    columns: Object.keys(sample) as Column[],
    async fetch(token, { start, end }) {
      const out: DayValues = new Map();
      for (const p of await dailyRollUp(token, dataType, start, end)) {
        const date = p.civilStartTime?.date;
        const value = p[field] as T | undefined;
        if (date && value) out.set(isoDay(date), read(value));
      }
      return out;
    },
  };
}

/**
 * A once-a-day summary (resting HR, HRV, SpO₂) read with `list`. The filter wants the
 * snake_case name (daily_resting_heart_rate.date) while the response uses camelCase.
 */
function dailySummary<T extends { date?: CivilDate }>(
  dataType: string,
  field: string,
  read: (v: T) => Partial<DailyMetrics>,
): DailySource {
  const filterField = dataType.replace(/-/g, "_");
  return {
    name: dataType,
    scope: "metrics",
    columns: Object.keys(read({} as T)) as Column[],
    async fetch(token, { start, end }) {
      const filter = `${filterField}.date >= "${isoDay(civil(start))}" AND ${filterField}.date < "${isoDay(civil(end))}"`;
      const out: DayValues = new Map();
      for (const p of await listPoints(token, dataType, filter)) {
        const value = p[field] as T | undefined;
        if (value?.date) out.set(isoDay(value.date), read(value));
      }
      return out;
    },
  };
}

type SleepPoint = {
  interval?: { startTime?: string; endTime?: string; civilEndTime?: { date?: CivilDate } };
  metadata?: { nap?: boolean };
  summary?: {
    minutesAsleep?: Int64;
    minutesAwake?: Int64;
    stagesSummary?: { type?: string; minutes?: Int64 }[];
  };
};

/** Night sleep, summed per wake-up day (naps are left out). */
const sleepSource: DailySource = {
  name: "sleep",
  scope: "sleep",
  columns: ["sleep_min", "sleep_deep_min", "sleep_light_min", "sleep_rem_min", "sleep_awake_min", "sleep_start", "sleep_end"],
  async fetch(token, { start, end }) {
    const filter = `sleep.interval.civil_end_time >= "${isoDay(civil(start))}" AND sleep.interval.civil_end_time < "${isoDay(civil(end))}"`;
    const out: DayValues = new Map();
    for (const p of await listPoints(token, "sleep", filter)) {
      const s = p.sleep as SleepPoint | undefined;
      const date = s?.interval?.civilEndTime?.date;
      if (!s || !date || s.metadata?.nap) continue;

      const key = isoDay(date);
      const row = out.get(key) ?? {};
      const add = (col: Column, v: number | undefined) => {
        if (v !== undefined) (row as Record<string, number>)[col] = ((row[col] as number | undefined) ?? 0) + v;
      };
      add("sleep_min", num(s.summary?.minutesAsleep));
      const stage = (type: string) => num(s.summary?.stagesSummary?.find((x) => x.type === type)?.minutes);
      add("sleep_deep_min", stage("DEEP"));
      add("sleep_light_min", stage("LIGHT"));
      add("sleep_rem_min", stage("REM"));
      add("sleep_awake_min", stage("AWAKE") ?? num(s.summary?.minutesAwake));
      if (s.interval?.startTime && (!row.sleep_start || s.interval.startTime < row.sleep_start)) {
        row.sleep_start = s.interval.startTime;
      }
      if (s.interval?.endTime && (!row.sleep_end || s.interval.endTime > row.sleep_end)) {
        row.sleep_end = s.interval.endTime;
      }
      out.set(key, row);
    }
    return out;
  },
};

const DAILY_SOURCES: DailySource[] = [
  // Activity
  rollup<{ countSum?: Int64 }>("steps", "activity", "steps", (v) => ({ steps: round(num(v.countSum)) ?? null })),
  rollup<{ millimetersSum?: Int64 }>("distance", "activity", "distance", (v) => ({
    distance_m: round(num(v.millimetersSum) !== undefined ? num(v.millimetersSum)! / 1000 : undefined, 2) ?? null,
  })),
  rollup<{ kcalSum?: number }>("total-calories", "activity", "totalCalories", (v) => ({
    calories_kcal: num(v.kcalSum) ?? null,
  })),
  rollup<{ countSum?: Int64 }>("floors", "activity", "floors", (v) => ({ floors: round(num(v.countSum)) ?? null })),
  rollup<{ sumInFatBurnHeartZone?: Int64; sumInCardioHeartZone?: Int64; sumInPeakHeartZone?: Int64 }>(
    "active-zone-minutes",
    "activity",
    "activeZoneMinutes",
    (v) => {
      const parts = [v.sumInFatBurnHeartZone, v.sumInCardioHeartZone, v.sumInPeakHeartZone].map(num);
      return {
        active_zone_minutes: parts.some((p) => p !== undefined) ? parts.reduce<number>((s, p) => s + (p ?? 0), 0) : null,
      };
    },
  ),
  rollup<{ kcalSum?: number }>("active-energy-burned", "activity", "activeEnergyBurned", (v) => ({
    active_kcal: num(v.kcalSum) ?? null,
  })),
  rollup<{ durationSum?: string }>("sedentary-period", "activity", "sedentaryPeriod", (v) => ({
    sedentary_min: round(seconds(v.durationSum) !== undefined ? seconds(v.durationSum)! / 60 : undefined) ?? null,
  })),
  // Heart & body
  rollup<{ beatsPerMinuteAvg?: number; beatsPerMinuteMin?: number; beatsPerMinuteMax?: number }>(
    "heart-rate",
    "metrics",
    "heartRate",
    (v) => ({
      hr_avg: round(num(v.beatsPerMinuteAvg), 1) ?? null,
      hr_min: num(v.beatsPerMinuteMin) ?? null,
      hr_max: num(v.beatsPerMinuteMax) ?? null,
    }),
  ),
  rollup<{ weightGramsAvg?: number }>("weight", "metrics", "weight", (v) => ({
    weight_kg: round(num(v.weightGramsAvg) !== undefined ? num(v.weightGramsAvg)! / 1000 : undefined, 1) ?? null,
  })),
  dailySummary<{ date?: CivilDate; beatsPerMinute?: Int64 }>(
    "daily-resting-heart-rate",
    "dailyRestingHeartRate",
    (v) => ({ resting_hr: round(num(v.beatsPerMinute)) ?? null }),
  ),
  dailySummary<{ date?: CivilDate; averageHeartRateVariabilityMilliseconds?: number }>(
    "daily-heart-rate-variability",
    "dailyHeartRateVariability",
    (v) => ({ hrv_ms: round(num(v.averageHeartRateVariabilityMilliseconds), 1) ?? null }),
  ),
  dailySummary<{ date?: CivilDate; averagePercentage?: number }>(
    "daily-oxygen-saturation",
    "dailyOxygenSaturation",
    (v) => ({ spo2_pct: round(num(v.averagePercentage), 1) ?? null }),
  ),
  // Sleep
  sleepSource,
];

// ---------------------------------------------------------------------------
// Exercise sessions

type ExercisePoint = {
  interval?: { startTime?: string; endTime?: string };
  exerciseType?: string;
  displayName?: string;
  activeDuration?: string;
  metricsSummary?: {
    caloriesKcal?: number;
    distanceMillimeters?: number;
    steps?: Int64;
    averageHeartRateBeatsPerMinute?: Int64;
    activeZoneMinutes?: Int64;
  };
};

async function fetchExercises(token: string, end: Date) {
  const start = daysBefore(end, EXERCISE_DAYS);
  const filter = `exercise.interval.civil_start_time >= "${isoDay(civil(start))}" AND exercise.interval.civil_start_time < "${isoDay(civil(end))}"`;
  const rows = [];
  for (const p of await listPoints(token, "exercise", filter)) {
    const e = p.exercise as ExercisePoint | undefined;
    if (!e?.interval?.startTime || typeof p.name !== "string") continue;
    const m = e.metricsSummary ?? {};
    const mm = num(m.distanceMillimeters);
    rows.push({
      external_id: p.name,
      exercise_type: e.exerciseType ?? null,
      display_name: e.displayName || null,
      started_at: e.interval.startTime,
      ended_at: e.interval.endTime ?? null,
      active_duration_s: round(seconds(e.activeDuration)) ?? null,
      calories_kcal: round(num(m.caloriesKcal)) ?? null,
      distance_m: mm !== undefined ? round(mm / 1000, 1)! : null,
      steps: round(num(m.steps)) ?? null,
      avg_hr: round(num(m.averageHeartRateBeatsPerMinute)) ?? null,
      active_zone_minutes: round(num(m.activeZoneMinutes)) ?? null,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------

/**
 * Pulls the last SYNC_DAYS days of daily metrics (and EXERCISE_DAYS of exercise sessions)
 * for every scope the user granted. Days are the user's civil (local) days, as Google reports them.
 * One metric failing doesn't stop the others; its error is saved on the connection.
 */
export async function syncGoogleHealth(supabase: Supabase, userId: string) {
  // End is exclusive and a day ahead of UTC so users east of UTC still get "today".
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 2);
  const range = { start: daysBefore(end, SYNC_DAYS), end };

  try {
    const { token, scopes } = await connection(supabase, userId);
    const sources = DAILY_SOURCES.filter((s) => scopes.has(s.scope));

    const [daily, exercises] = await Promise.all([
      Promise.allSettled(sources.map((s) => s.fetch(token, range))),
      scopes.has("activity") ? fetchExercises(token, end).then(
        (rows) => ({ status: "fulfilled" as const, value: rows }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ) : null,
    ]);

    const failures: string[] = [];
    const fail = (reason: unknown) => {
      // Account-level problems apply to every metric, so stop and report just that.
      if (reason instanceof SyncError && (reason.needsReconnect || reason.message.includes("isn't linked"))) throw reason;
      failures.push(reason instanceof Error ? reason.message : String(reason));
    };

    // Only columns from sources that succeeded are written, so a failed metric keeps its old values.
    const columns = new Set<Column>();
    const days = new Map<string, Partial<DailyMetrics>>();
    daily.forEach((result, i) => {
      if (result.status === "rejected") return fail(result.reason);
      sources[i].columns.forEach((c) => columns.add(c));
      for (const [day, values] of result.value) days.set(day, { ...days.get(day), ...values });
    });

    const now = new Date().toISOString();
    if (days.size > 0) {
      const rows = [...days].map(([day, values]) => {
        const row: Record<string, unknown> = { user_id: userId, source: "google_health", day, synced_at: now };
        for (const c of columns) row[c] = values[c] ?? null;
        return row;
      });
      const { error } = await supabase.from("daily_activity").upsert(rows, { onConflict: "user_id,source,day" });
      if (error) throw new SyncError(error.message);
    }

    if (exercises?.status === "rejected") fail(exercises.reason);
    else if (exercises && exercises.value.length > 0) {
      const { error } = await supabase.from("synced_exercises").upsert(
        exercises.value.map((r) => ({ ...r, user_id: userId, source: "google_health", synced_at: now })),
        { onConflict: "user_id,source,external_id" },
      );
      if (error) failures.push(`exercise: ${error.message}`);
    }

    await supabase
      .from("google_health_connections")
      .update({
        last_synced_at: now,
        last_sync_error: failures.length ? `Some data couldn't be synced — ${failures.join("; ")}` : null,
      })
      .eq("user_id", userId);
    return { days: days.size, exercises: exercises?.status === "fulfilled" ? exercises.value.length : 0 };
  } catch (e) {
    let err = e instanceof SyncError ? e : new SyncError(e instanceof Error ? e.message : "Sync failed.");
    // PostgREST's wording when a migration hasn't been applied yet.
    if (/schema cache/.test(err.message)) {
      err = new SyncError(
        `The database is missing tables or columns for this data — run the latest file in supabase/migrations in the Supabase SQL Editor. (${err.message})`,
      );
    }
    await supabase
      .from("google_health_connections")
      .update({ last_sync_error: err.message })
      .eq("user_id", userId);
    throw err;
  }
}
