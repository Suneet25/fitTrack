import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";
import { Hero } from "./hero";
import { HeroAnimation } from "./hero-animation";
import { PageTransition } from "@/components/page-transition";

const features = [
  ["Workout log", "Sets, reps and weight for every session."],
  ["Diet tracking", "Meals, calories and macros in one place."],
  ["AI coach", "Ask about your progress, using your own OpenAI key."],
  ["Auto sync", "Sync steps, distance and calories from Google Health."],
];

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  return (
    <div className="flex flex-1 flex-col">
      {claims ? (
        <AppHeader email={claims.email as string | undefined} />
      ) : (
        <header className="border-b border-line bg-surface" style={{ viewTransitionName: "site-header" }}>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Fit<span className="text-primary-600 dark:text-primary-400">Track</span>
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                href="/login"
                data-cta="home_sign_in"
                className="whitespace-nowrap rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                Sign in
              </Link>
            </div>
          </div>
        </header>
      )}
      <PageTransition>
        <main className="flex flex-1 flex-col">
          <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-16">
            <div className="grid items-center gap-8 md:grid-cols-[3fr_2fr]">
              <div>
                <p style={{ "--i": 0 } as React.CSSProperties} className="enter-up text-sm font-semibold uppercase tracking-widest text-secondary-600 dark:text-secondary-400">
                  Train · Eat · Improve
                </p>
                <Hero />
              </div>
              {/* Original animation (public/lottie); swap in any LottieFiles JSON with the same path. */}
              <div style={{ "--i": 2 } as React.CSSProperties} className="enter-up relative order-first mx-auto aspect-square w-56 sm:w-64 md:order-0 md:w-full md:max-w-sm">
                <HeroAnimation />
              </div>
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
      </PageTransition>
    </div>
  );
}
