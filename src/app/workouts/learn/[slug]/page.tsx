import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseDemo } from "@/components/exercise-demo";
import { getExercise, imageUrl } from "@/lib/workouts/exercises";

export default async function ExercisePage({ params }: PageProps<"/workouts/learn/[slug]">) {
  const { slug } = await params;
  const ex = getExercise(slug);
  if (!ex) notFound();

  const logHref = `/workouts/new?exercise=${ex.slug}`;

  return (
    // Bottom padding leaves room for the sticky "Log" bar on phones.
    <div className="pb-20 sm:pb-0">
      <Link href="/workouts/learn" className="text-sm font-medium text-ink-muted hover:text-ink">
        ← All exercises
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{ex.name}</h1>
          <p className="mt-1 text-sm capitalize text-ink-muted">
            {ex.group} · {ex.equipment} · {ex.level}
          </p>
        </div>
        <Link
          href={logHref}
          data-cta="exercise_log"
          className="hidden rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700 sm:block"
        >
          Log this exercise
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-line">
            <ExerciseDemo exercise={ex} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {ex.images.map((src, i) => (
              <figure key={src} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="relative aspect-[4/3]">
                  <Image
                    src={imageUrl(src)}
                    alt={`${ex.name} ${i === 0 ? "start" : "end"} position`}
                    fill
                    sizes="(min-width: 1024px) 290px, 50vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="px-3 py-2 text-xs font-medium text-ink-muted">
                  {i === 0 ? "Start" : "End"} position
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold">How to do it</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {ex.instructions.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <h2 className="font-semibold">Muscles worked</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {ex.primaryMuscles.map((m) => (
                <span key={m} className="rounded-full bg-primary-100 px-2.5 py-0.5 font-medium capitalize text-primary-800">
                  {m}
                </span>
              ))}
              {ex.secondaryMuscles.map((m) => (
                <span key={m} className="rounded-full bg-surface-muted px-2.5 py-0.5 capitalize text-ink-muted">
                  {m}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <Link
          href={logHref}
          data-cta="exercise_log"
          className="block rounded-lg bg-primary-600 py-3 text-center font-semibold text-white transition hover:bg-primary-700"
        >
          Log this exercise
        </Link>
      </div>
    </div>
  );
}
