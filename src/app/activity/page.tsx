import Link from "next/link";
import { Lottie } from "@/components/lottie";
import { PageTransition } from "@/components/page-transition";
import { getRemoteConfig } from "@/lib/remote-config/server";
import { createClient } from "@/lib/supabase/server";
import { grantedScopes } from "@/lib/google-health/oauth";
import { SYNC_DAYS, syncGoogleHealth, type DailyMetrics } from "@/lib/google-health/sync";
import { disconnect, syncNow } from "./actions";
import { LocalTime } from "./local-time";
import { PendingButton } from "./pending-button";

type DayRow = { day: string } & DailyMetrics;
type ExerciseRow = {
  id: string;
  exercise_type: string | null;
  display_name: string | null;
  started_at: string;
  active_duration_s: number | null;
  calories_kcal: number | null;
  distance_m: number | null;
  avg_hr: number | null;
};

const notices: Record<string, { tone: "ok" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Google Health connected. Your recent activity has been synced." },
  denied: { tone: "error", text: "You declined access in Google, so nothing was connected." },
  state: { tone: "error", text: "That sign-in link expired. Please try connecting again." },
  config: { tone: "error", text: "Google Health isn't configured on the server yet (missing client ID/secret)." },
  error: { tone: "error", text: "Couldn't finish connecting to Google Health. Please try again." },
};

const fmtInt = new Intl.NumberFormat("en-US");

const km = (m: number) => `${(m / 1000).toFixed(2)} km`;
const kcal = (n: number) => `${fmtInt.format(Math.round(n))} kcal`;
const hoursMins = (mins: number) =>
  mins < 60 ? `${Math.round(mins)} min` : `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, "0")}m`;

/** Metrics the 14-day chart can show. */
const CHARTS = {
  steps: { label: "Steps", value: (d: DayRow) => d.steps, format: (n: number) => fmtInt.format(n), unit: "steps" },
  sleep: { label: "Sleep", value: (d: DayRow) => d.sleep_min, format: hoursMins, unit: "" },
  azm: {
    label: "Zone minutes",
    value: (d: DayRow) => d.active_zone_minutes,
    format: (n: number) => fmtInt.format(n),
    unit: "min",
  },
  calories: { label: "Calories", value: (d: DayRow) => d.calories_kcal, format: kcal, unit: "" },
  rhr: { label: "Resting HR", value: (d: DayRow) => d.resting_hr, format: (n: number) => `${n}`, unit: "bpm" },
} as const;
type ChartKey = keyof typeof CHARTS;

const EMPTY_DAY: DailyMetrics = {
  steps: null, distance_m: null, calories_kcal: null, floors: null, active_zone_minutes: null, active_kcal: null,
  sedentary_min: null, resting_hr: null, hr_avg: null, hr_min: null, hr_max: null, hrv_ms: null, spo2_pct: null,
  weight_kg: null, sleep_min: null, sleep_deep_min: null, sleep_light_min: null, sleep_rem_min: null,
  sleep_awake_min: null, sleep_start: null, sleep_end: null,
};

function dayLabel(day: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
}

/** "OUTDOOR_BIKE" → "Outdoor bike" */
function exerciseLabel(e: ExerciseRow) {
  if (e.display_name) return e.display_name;
  const t = (e.exercise_type ?? "Workout").toLowerCase().replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Reads the Google Health link, syncing first if the data is stale. */
async function loadConnection(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, staleMs: number) {
  const read = () =>
    supabase
      .from("google_health_connections")
      .select("connected_at, last_synced_at, last_sync_error, scope")
      .eq("user_id", userId)
      .maybeSingle()
      .then((r) => r.data);

  const conn = await read();
  if (!conn || (conn.last_synced_at && Date.now() - Date.parse(conn.last_synced_at) < staleMs)) return conn;
  await syncGoogleHealth(supabase, userId).catch(() => {});
  return read();
}

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const { google, reason, metric } = await searchParams;

  const { values: config } = await getRemoteConfig();
  if (!config.google_health_enabled) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="mt-6 rounded-2xl border border-line bg-surface p-6 text-sm text-ink-muted">
          Google Health sync is temporarily unavailable. Your workouts and the exercise library still work as
          usual — please check back later.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user!.id;

  const conn = await loadConnection(supabase, userId, config.activity_auto_sync_minutes * 60_000);
  const scopes = grantedScopes(conn?.scope);
  const notice =
    google === "connected" && conn?.last_sync_error
      ? { tone: "error" as const, text: "Google account connected, but the first sync didn't work — see below." }
      : typeof google === "string"
        ? notices[google]
        : undefined;

  // Synced data is only shown while Google Health is connected.
  const [{ data: rows }, { data: exercises }] = conn
    ? await Promise.all([
        supabase
          .from("daily_activity")
          .select("*")
          .eq("source", "google_health")
          .order("day", { ascending: false })
          .limit(SYNC_DAYS),
        supabase
          .from("synced_exercises")
          .select("id, exercise_type, display_name, started_at, active_duration_s, calories_kcal, distance_m, avg_hr")
          .eq("source", "google_health")
          .order("started_at", { ascending: false })
          .limit(10),
      ])
    : [{ data: [] as DayRow[] }, { data: [] as ExerciseRow[] }];

  const byDay = new Map((rows ?? []).map((r: DayRow) => [r.day, { ...EMPTY_DAY, ...r }]));
  const latest = rows?.[0]?.day as string | undefined;
  // A continuous 14-day window ending on the latest synced day; gaps show as empty bars.
  const series: DayRow[] = latest
    ? Array.from({ length: SYNC_DAYS }, (_, i) => {
        const day = shiftDay(latest, i - (SYNC_DAYS - 1));
        return byDay.get(day) ?? { day, ...EMPTY_DAY };
      })
    : [];
  const today = latest ? byDay.get(latest)! : undefined;

  /** Most recent non-empty value of a column, for metrics that aren't recorded every day. */
  const recent = <K extends keyof DailyMetrics>(col: K) => {
    for (let i = series.length - 1; i >= 0; i--) {
      const v = series[i][col];
      if (v !== null) return { value: v as NonNullable<DailyMetrics[K]>, day: series[i].day };
    }
    return undefined;
  };

  const available = (Object.keys(CHARTS) as ChartKey[]).filter((k) => series.some((d) => CHARTS[k].value(d) !== null));
  const chartKey: ChartKey = available.includes(metric as ChartKey) ? (metric as ChartKey) : (available[0] ?? "steps");

  const sleep = recent("sleep_min") ? series.findLast((d) => d.sleep_min !== null) : undefined;
  const missing = [!scopes.has("sleep") && "sleep", !scopes.has("metrics") && "heart rate & body"].filter(Boolean);

  const extraStats = [
    stat("Zone minutes", recent("active_zone_minutes"), (v) => `${v} min`, latest),
    stat("Active calories", recent("active_kcal"), kcal, latest),
    stat("Floors", recent("floors"), (v) => fmtInt.format(v), latest),
    stat("Sedentary", recent("sedentary_min"), hoursMins, latest),
    stat("Resting heart rate", recent("resting_hr"), (v) => `${v} bpm`, latest),
    stat("Heart rate variability", recent("hrv_ms"), (v) => `${v} ms`, latest),
    stat("Blood oxygen (SpO₂)", recent("spo2_pct"), (v) => `${v}%`, latest),
    stat("Weight", recent("weight_kg"), (v) => `${v} kg`, latest),
  ].filter((s) => s !== null);

  return (
    <PageTransition>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
            <p className="mt-1 text-ink-muted">Activity, sleep and heart data synced from Google Health.</p>
          </div>
          {conn && (
            <div className="flex flex-wrap items-center gap-2">
              <form action={syncNow} data-cta="health_sync">
                <PendingButton
                  pendingLabel="Syncing…"
                  className="rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700"
                >
                  Sync now
                </PendingButton>
              </form>
              <form action={disconnect} data-cta="health_disconnect">
                <PendingButton
                  pendingLabel="Disconnecting…"
                  className="rounded-lg border border-line px-4 py-2.5 font-semibold transition hover:border-secondary-300"
                >
                  Disconnect
                </PendingButton>
              </form>
            </div>
          )}
        </div>

        {notice && (
          <p
            role="status"
            className={`mt-6 rounded-lg px-3 py-2 text-sm ${
              notice.tone === "ok" ? "bg-primary-50 text-primary-800" : "bg-secondary-50 text-secondary-800"
            }`}
          >
            {notice.text}
            {notice.tone === "error" && typeof reason === "string" && (
              <span className="mt-1 block text-xs opacity-80">Details: {reason}</span>
            )}
          </p>
        )}

        {!conn && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
            <Lottie src="/lottie/activity-watch.json" className="mx-auto mb-2 h-40 w-40" />
          <h2 className="text-lg font-semibold">Connect Google Health</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Link your Google account to bring in steps, workouts, sleep and heart data from your phone or Fitbit.
              FitTrack only asks for read access.
            </p>
            {/* A plain link: the route handler redirects to Google's consent screen. */}
            <a
              href="/api/google-health/connect"
              data-cta="health_connect"
              className="mt-5 inline-block rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700"
            >
              Connect Google account
            </a>
          </div>
        )}

        {conn && (
          <p className="mt-4 text-sm text-ink-muted">
            {conn.last_synced_at ? `Last synced ${timeAgo(conn.last_synced_at)}.` : "Not synced yet."}
          </p>
        )}
        {conn?.last_sync_error && (
          <p role="alert" className="mt-3 rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-800">
            {conn.last_sync_error.startsWith("Some data") ? "" : "Last sync failed: "}
            {conn.last_sync_error}
          </p>
        )}

        {conn && missing.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900">
            <p>
              <span className="font-semibold">Get more from your watch.</span> Allow read access to {missing.join(" and ")}{" "}
              to see sleep stages, resting heart rate, HRV, SpO₂ and weight.
            </p>
            <a
              href="/api/google-health/connect"
              data-cta="health_allow_more"
              className="rounded-lg bg-primary-600 px-3 py-2 font-semibold text-white transition hover:bg-primary-700"
            >
              Allow access
            </a>
          </div>
        )}

        {today && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <Stat label="Steps" value={today.steps !== null ? fmtInt.format(today.steps) : "—"} />
              <Stat label="Distance" value={today.distance_m !== null ? km(today.distance_m) : "—"} />
              <Stat label="Calories burned" value={today.calories_kcal !== null ? kcal(today.calories_kcal) : "—"} />
            </section>
            <p className="mt-2 text-xs text-ink-muted">
              Totals for {dayLabel(latest!, { weekday: "long", month: "short", day: "numeric" })}.
            </p>

            {extraStats.length > 0 && (
              <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {extraStats.map((s) => (
                  <div key={s.label} className="reveal rounded-2xl border border-line bg-surface p-4">
                    <p className="text-xs text-ink-muted">{s.label}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums tracking-tight">{s.value}</p>
                    {s.note && <p className="text-xs text-ink-muted">{s.note}</p>}
                  </div>
                ))}
              </section>
            )}

            {sleep && <SleepCard night={sleep} />}

            <section className="reveal mt-8 rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Last {SYNC_DAYS} days</h2>
                {available.length > 1 && (
                  <nav className="flex flex-wrap gap-1.5 text-sm font-medium" aria-label="Chart metric">
                    {available.map((k) => (
                      <Link
                        key={k}
                        href={`/activity?metric=${k}`}
                        data-cta="activity_chart_metric"
                        scroll={false}
                        className={`rounded-full border px-3 py-1 transition ${
                          k === chartKey
                            ? "border-primary-600 bg-primary-600 text-white"
                            : "border-line text-ink-muted hover:text-ink"
                        }`}
                      >
                        {CHARTS[k].label}
                      </Link>
                    ))}
                  </nav>
                )}
              </div>
              <BarChart series={series} chartKey={chartKey} latest={latest!} />

              <details className="mt-5 text-sm">
                <summary className="cursor-pointer text-ink-muted hover:text-ink">Show as table</summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-left">
                    <thead className="text-ink-muted">
                      <tr>
                        <th className="py-1.5 pr-4 font-medium">Day</th>
                        <th className="py-1.5 pr-4 text-right font-medium">Steps</th>
                        <th className="py-1.5 pr-4 text-right font-medium">Distance</th>
                        <th className="py-1.5 pr-4 text-right font-medium">Calories</th>
                        <th className="py-1.5 pr-4 text-right font-medium">Zone min</th>
                        <th className="py-1.5 pr-4 text-right font-medium">Sleep</th>
                        <th className="py-1.5 text-right font-medium">Resting HR</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {[...series].reverse().map((d) => (
                        <tr key={d.day} className="border-t border-line">
                          <td className="py-1.5 pr-4">{dayLabel(d.day, { weekday: "short", month: "short", day: "numeric" })}</td>
                          <td className="py-1.5 pr-4 text-right">{d.steps !== null ? fmtInt.format(d.steps) : "—"}</td>
                          <td className="py-1.5 pr-4 text-right">{d.distance_m !== null ? km(d.distance_m) : "—"}</td>
                          <td className="py-1.5 pr-4 text-right">{d.calories_kcal !== null ? kcal(d.calories_kcal) : "—"}</td>
                          <td className="py-1.5 pr-4 text-right">{d.active_zone_minutes ?? "—"}</td>
                          <td className="py-1.5 pr-4 text-right">{d.sleep_min !== null ? hoursMins(d.sleep_min) : "—"}</td>
                          <td className="py-1.5 text-right">{d.resting_hr !== null ? `${d.resting_hr} bpm` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          </>
        )}

        {conn && exercises && exercises.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Tracked workouts</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Sessions recorded by your phone or watch.</p>
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
              {exercises.map((e: ExerciseRow) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
                  <div>
                    <p className="font-medium">{exerciseLabel(e)}</p>
                    <p className="text-xs text-ink-muted">
                      <LocalTime iso={e.started_at} options={{ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} />
                    </p>
                  </div>
                  <p className="text-sm tabular-nums text-ink-muted">
                    {[
                      e.active_duration_s !== null && hoursMins(e.active_duration_s / 60),
                      e.distance_m ? km(e.distance_m) : null,
                      e.calories_kcal !== null && kcal(e.calories_kcal),
                      e.avg_hr !== null && `${e.avg_hr} bpm avg`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {conn && !today && !conn.last_sync_error && (
          <p className="mt-6 rounded-2xl border border-line bg-surface p-6 text-sm text-ink-muted">
            No activity found in the last {SYNC_DAYS} days. Make sure your phone or Fitbit is syncing to your
            Google account, then press “Sync now”.
          </p>
        )}
      </div>
    </PageTransition>
  );
}

function stat<T>(label: string, found: { value: T; day: string } | undefined, format: (v: T) => string, latest?: string) {
  if (!found) return null;
  return {
    label,
    value: format(found.value),
    // Say when a value isn't from the latest day (e.g. last weigh-in).
    note: found.day === latest ? null : dayLabel(found.day, { month: "short", day: "numeric" }),
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

const STAGES = [
  { key: "sleep_deep_min", label: "Deep", className: "bg-primary-800" },
  { key: "sleep_light_min", label: "Light", className: "bg-primary-400" },
  { key: "sleep_rem_min", label: "REM", className: "bg-secondary-400" },
  { key: "sleep_awake_min", label: "Awake", className: "bg-line" },
] as const;

function SleepCard({ night }: { night: DayRow }) {
  const stages = STAGES.map((s) => ({ ...s, minutes: night[s.key] ?? 0 })).filter((s) => s.minutes > 0);
  const total = stages.reduce((sum, s) => sum + s.minutes, 0);

  return (
    <section className="reveal mt-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Sleep</h2>
        <p className="text-sm text-ink-muted">
          Woke up {dayLabel(night.day, { weekday: "short", month: "short", day: "numeric" })}
        </p>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{hoursMins(night.sleep_min!)}</p>
      {night.sleep_start && night.sleep_end && (
        <p className="text-sm text-ink-muted">
          <LocalTime iso={night.sleep_start} options={{ hour: "numeric", minute: "2-digit" }} /> –{" "}
          <LocalTime iso={night.sleep_end} options={{ hour: "numeric", minute: "2-digit" }} />
        </p>
      )}

      {total > 0 && (
        <>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full" role="img" aria-label="Sleep stages">
            {stages.map((s) => (
              <div key={s.key} className={s.className} style={{ width: `${(s.minutes / total) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {stages.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${s.className}`} />
                {s.label} <span className="tabular-nums text-ink-muted">{hoursMins(s.minutes)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function BarChart({ series, chartKey, latest }: { series: DayRow[]; chartKey: ChartKey; latest: string }) {
  const chart = CHARTS[chartKey];
  const values = series.map((d) => chart.value(d));
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) {
    return <p className="mt-4 text-sm text-ink-muted">No {chart.label.toLowerCase()} data in the last {SYNC_DAYS} days yet.</p>;
  }
  const max = Math.max(1, ...present);
  const avg = present.reduce((s, v) => s + v, 0) / present.length;
  const withUnit = (n: number) => `${chart.format(Math.round(n))}${chart.unit ? ` ${chart.unit}` : ""}`;

  return (
    <>
      <p className="mt-2 text-sm text-ink-muted">Avg {withUnit(avg)} / day</p>
      <div className="relative mt-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <span className="absolute -top-5 right-0 text-xs text-ink-muted">{chart.format(Math.round(max))}</span>
        <div key={chartKey} className="flex h-44 items-end gap-0.5 border-b border-line" role="img" aria-label={`Daily ${chart.label.toLowerCase()} bar chart`}>
          {series.map((d, i) => {
            const v = values[i];
            return (
              <div key={d.day} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none">
                <div
                  className={`bar-grow w-full rounded-t-sm transition ${
                    d.day === latest ? "bg-primary-600" : "bg-primary-400"
                  } group-hover:bg-primary-700 group-focus:bg-primary-700`}
                  style={{ height: v ? `${(v / max) * 100}%` : 0, "--i": i } as React.CSSProperties}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-sm group-hover:block group-focus:block">
                  <div className="text-ink-muted">{dayLabel(d.day, { weekday: "short", month: "short", day: "numeric" })}</div>
                  <div className="font-semibold">{v !== null ? withUnit(v) : "No data"}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-0.5 text-center text-[10px] text-ink-muted">
          {series.map((d) => (
            <span key={d.day} className="flex-1">
              {dayLabel(d.day, { weekday: "narrow" })}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
