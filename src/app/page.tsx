import Link from "next/link";

const features = [
  ["Workout log", "Sets, reps and weight for every session."],
  ["Diet tracking", "Meals, calories and macros in one place."],
  ["AI coach", "Ask about your progress, using your own OpenAI key."],
  ["Auto sync", "Pull runs and rides from Strava and Google Fit."],
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-secondary-600">
          Train · Eat · Improve
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Your workouts and diet, <span className="text-primary-600">finally in one place.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink-muted">
          Log training and meals, watch your progress, and talk it through with an AI coach that knows
          your numbers.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-primary-600 px-5 py-3 font-semibold text-white transition hover:bg-primary-700"
          >
            Get started
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-line bg-surface px-5 py-3 font-semibold transition hover:border-primary-300"
          >
            Go to dashboard
          </Link>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2">
          {features.map(([title, body]) => (
            <li key={title} className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-ink-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
