import Image from "next/image";
import Link from "next/link";
import { PageTransition, FORWARD } from "@/components/page-transition";
import {
  exercises,
  getExercise,
  imageUrl,
  muscleGroups,
  starterPlan,
  type MuscleGroup,
} from "@/lib/workouts/exercises";

export default async function LearnPage({ searchParams }: PageProps<"/workouts/learn">) {
  const params = await searchParams;
  const group = muscleGroups.find((g) => g.id === params.group)?.id as MuscleGroup | undefined;
  const shown = group ? exercises.filter((e) => e.group === group) : exercises;

  return (
    <PageTransition>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Learn the moves</h1>
        <p className="mt-1 text-ink-muted">
          Watch the demo, read the steps, then log it when you train.
        </p>

        <section className="mt-8 rounded-2xl border border-primary-200 bg-primary-50 p-5 text-primary-950">
          <h2 className="font-semibold">New to lifting? Start here.</h2>
          <p className="mt-1 text-sm text-primary-900">
            Train 3 days a week, alternating A and B (A-B-A, then B-A-B). Pick a weight you could lift a couple more
            times. When every set hits the target, add a little weight next week.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {starterPlan.map((day) => (
              <div key={day.id} className="reveal rounded-xl bg-surface p-4 text-ink">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{day.name}</h3>
                  <Link
                    href={`/workouts/new?plan=${day.id}`}
                    data-cta="plan_start" transitionTypes={FORWARD}
                    className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700"
                  >
                    Start
                  </Link>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {day.items.map((item) => {
                    const ex = getExercise(item.slug)!;
                    return (
                      <li key={item.slug} className="flex justify-between gap-2">
                        <Link href={`/workouts/learn/${ex.slug}`} data-cta="exercise_open" transitionTypes={FORWARD} className="hover:text-primary-700 dark:hover:text-primary-400 hover:underline">
                          {ex.name}
                        </Link>
                        <span className="shrink-0 tabular-nums text-ink-muted">
                          {item.sets} × {item.reps}
                          {ex.unit === "seconds" ? "s" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-2 text-sm font-medium">
          <FilterChip href="/workouts/learn" active={!group} label="All" />
          {muscleGroups.map((g) => (
            <FilterChip key={g.id} href={`/workouts/learn?group=${g.id}`} active={group === g.id} label={g.label} />
          ))}
        </div>

        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((ex, i) => (
            <li key={ex.slug} className="reveal">
              <Link
                href={`/workouts/learn/${ex.slug}`}
                data-cta="exercise_open" transitionTypes={FORWARD}
                className="group block overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-primary-300"
              >
                <div className="relative aspect-[4/3] bg-surface-muted">
                  <Image
                    src={imageUrl(ex.images[0])}
                    alt={`${ex.name} start position`}
                    fill
                    loading={i < 3 ? "eager" : "lazy"}
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-opacity duration-300 group-hover:opacity-0"
                  />
                  {ex.images[1] && (
                    <Image
                      src={imageUrl(ex.images[1])}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                      className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />
                  )}
                  {ex.demoVideo && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                      ▶ Video
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-semibold">{ex.name}</h2>
                  <p className="mt-0.5 text-sm capitalize text-ink-muted">
                    {ex.group} · {ex.equipment} · {ex.level}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </PageTransition>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      data-cta="exercise_filter"
      className={`rounded-full border px-3 py-1 transition ${
        active
          ? "border-primary-600 bg-primary-600 text-white"
          : "border-line bg-surface text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
