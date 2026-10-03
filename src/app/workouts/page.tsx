import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { findExerciseByName, formatSet } from "@/lib/workouts/exercises";
import { formatDay, formatWeekRange, toDateString, weekNumber } from "@/lib/workouts/weeks";
import { deleteWorkout } from "./actions";
import { PageTransition, FORWARD } from "@/components/page-transition";

type SetRow = { exercise: string; set_number: number; reps: number | null; weight_kg: number | null };
type WorkoutRow = {
  id: string;
  performed_at: string;
  title: string | null;
  duration_min: number | null;
  notes: string | null;
  workout_sets: SetRow[];
};

export default async function WorkoutsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select("id, performed_at, title, duration_min, notes, workout_sets(exercise, set_number, reps, weight_kg)")
    .order("performed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("set_number", { referencedTable: "workout_sets" });
  const workouts = (data ?? []) as WorkoutRow[];

  // Week 1 is the week of the user's first ever workout.
  const firstDate = workouts.length ? toDateString(workouts[workouts.length - 1].performed_at) : null;
  const weeks = new Map<number, { range: string; workouts: WorkoutRow[] }>();
  for (const w of workouts) {
    const date = toDateString(w.performed_at);
    const n = weekNumber(firstDate!, date);
    if (!weeks.has(n)) weeks.set(n, { range: formatWeekRange(date), workouts: [] });
    weeks.get(n)!.workouts.push(w);
  }

  return (
    <PageTransition>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Workouts</h1>
            <p className="mt-1 text-ink-muted">Every set, rep and kilo — week by week.</p>
          </div>
          <Link
            href="/workouts/new"
            data-cta="workout_log_start" transitionTypes={FORWARD}
            className="rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700"
          >
            + Log workout
          </Link>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-800">
            Couldn&apos;t load your workouts: {error.message}
          </p>
        )}

        {!error && workouts.length === 0 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
            <h2 className="text-lg font-semibold">Week 1 starts with your first workout</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Not sure what to do? Learn the exercises, follow the beginner plan, then come back here to log
              your sets.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/workouts/learn"
                data-cta="workout_learn_start" transitionTypes={FORWARD}
                className="rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700"
              >
                Learn the exercises
              </Link>
              <Link
                href="/workouts/new"
                data-cta="workout_log_start" transitionTypes={FORWARD}
                className="rounded-lg border border-line px-4 py-2.5 font-semibold transition hover:border-primary-300"
              >
                Log a workout
              </Link>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-10">
          {[...weeks].map(([n, week]) => {
            const sets = week.workouts.flatMap((w) => w.workout_sets);
            const volume = sets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight_kg ?? 0), 0);
            return (
              <section key={n}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                  <h2 className="text-lg font-bold">
                    Week {n} <span className="ml-1 text-sm font-normal text-ink-muted">{week.range}</span>
                  </h2>
                  <p className="text-sm tabular-nums text-ink-muted">
                    {week.workouts.length} workout{week.workouts.length === 1 ? "" : "s"} · {sets.length} sets
                    {volume > 0 && ` · ${Math.round(volume).toLocaleString()} kg lifted`}
                  </p>
                </div>
                <ul className="mt-4 space-y-4">
                  {week.workouts.map((w) => (
                    <WorkoutCard key={w.id} workout={w} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </PageTransition>
  );
}

function WorkoutCard({ workout: w }: { workout: WorkoutRow }) {
  // Group sets by exercise, keeping the order they were logged in.
  const byExercise = new Map<string, SetRow[]>();
  for (const s of w.workout_sets) {
    if (!byExercise.has(s.exercise)) byExercise.set(s.exercise, []);
    byExercise.get(s.exercise)!.push(s);
  }

  return (
    <li className="reveal rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary-700 dark:text-primary-400">{formatDay(toDateString(w.performed_at))}</p>
          <h3 className="font-semibold">{w.title ?? "Workout"}</h3>
          {w.duration_min && <p className="text-sm text-ink-muted">{w.duration_min} min</p>}
        </div>
        <form action={deleteWorkout} data-cta="workout_delete">
          <input type="hidden" name="id" value={w.id} />
          <button type="submit" className="text-sm text-ink-muted hover:text-secondary-700 dark:hover:text-secondary-400">
            Delete
          </button>
        </form>
      </div>

      <table className="mt-4 w-full text-sm">
        <tbody>
          {[...byExercise].map(([name, sets]) => {
            const ex = findExerciseByName(name);
            return (
              <tr key={name} className="border-t border-line align-top">
                <td className="py-2 pr-4 font-medium">
                  {ex ? (
                    <Link href={`/workouts/learn/${ex.slug}`} data-cta="exercise_open" transitionTypes={FORWARD} className="hover:text-primary-700 dark:hover:text-primary-400 hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </td>
                <td className="py-2 text-right tabular-nums text-ink-muted">
                  {sets.map((s) => formatSet(s.reps, s.weight_kg, ex?.unit)).join(" · ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {w.notes && <p className="mt-3 text-sm italic text-ink-muted">{w.notes}</p>}
    </li>
  );
}
