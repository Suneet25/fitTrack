import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exercises, getExercise, starterPlan } from "@/lib/workouts/exercises";
import { toDateString } from "@/lib/workouts/weeks";
import { LogForm, type DraftExercise, type LastSession } from "./log-form";

export default async function NewWorkoutPage({ searchParams }: PageProps<"/workouts/new">) {
  const params = await searchParams;
  const plan = starterPlan.find((d) => d.id === params.plan);
  const single = typeof params.exercise === "string" ? getExercise(params.exercise) : undefined;

  let title = "";
  let draft: DraftExercise[] = [];
  if (plan) {
    title = plan.name;
    draft = plan.items.map((item) => ({
      name: getExercise(item.slug)!.name,
      sets: Array.from({ length: item.sets }, () => ({ reps: String(item.reps), weight: "" })),
    }));
  } else if (single) {
    draft = [{ name: single.name, sets: [{ reps: "", weight: "" }] }];
  }

  // Most recent sets per exercise, shown as "Last time" to help with progression.
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("workouts")
    .select("performed_at, workout_sets(exercise, set_number, reps, weight_kg)")
    .order("performed_at", { ascending: false })
    .order("set_number", { referencedTable: "workout_sets" })
    .limit(40);

  const lastSessions: Record<string, LastSession> = {};
  for (const w of recent ?? []) {
    const date = toDateString(w.performed_at);
    for (const s of w.workout_sets) {
      const key = s.exercise.toLowerCase();
      const entry = (lastSessions[key] ??= { date, sets: [] });
      if (entry.date === date) entry.sets.push({ reps: s.reps, weight: s.weight_kg });
    }
  }

  return (
    <div>
      <Link href="/workouts" className="text-sm font-medium text-ink-muted hover:text-ink">
        ← Workouts
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Log a workout</h1>
      <p className="mt-1 text-ink-muted">Add each exercise, then the reps and weight for every set.</p>

      <LogForm
        initialTitle={title}
        initialExercises={draft}
        today={new Date().toISOString().slice(0, 10)}
        library={exercises.map((e) => ({ name: e.name, slug: e.slug, unit: e.unit, bodyweight: e.bodyweight }))}
        lastSessions={lastSessions}
      />
    </div>
  );
}
