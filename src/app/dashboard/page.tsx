import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getRemoteValue } from "@/lib/remote-config/server";
import { createClient } from "@/lib/supabase/server";
import { PageTransition, FORWARD } from "@/components/page-transition";

const cards = [
  { title: "Workouts", body: "Log exercises, sets, reps and weight, week by week.", tone: "primary", href: "/workouts" },
  { title: "Learn", body: "Exercise demos, step-by-step form and a beginner plan.", tone: "secondary", href: "/workouts/learn" },
  { title: "Activity", body: "Steps, distance and calories synced from Google Health.", tone: "primary", href: "/activity" },
  { title: "Diet", body: "Track meals, calories and macros.", tone: "secondary" },
  { title: "Progress", body: "Charts of your trends over time.", tone: "primary" },
  { title: "AI Coach", body: "Chat about your data with your own API key.", tone: "secondary" },
] as const satisfies readonly { title: string; body: string; tone: string; href?: string }[];

export default async function DashboardPage() {
  const supabase = await createClient();
  // getUser() verifies with Supabase Auth — the real check (proxy is only optimistic).
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?next=/dashboard");
  const healthEnabled = await getRemoteValue("google_health_enabled");
  const visibleCards = cards.filter((c) => healthEnabled || c.title !== "Activity");

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader email={data.user.email} />

      <PageTransition>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-ink-muted">Here&apos;s where your training and nutrition will live.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {visibleCards.map((c) => {
              const body = (
                <>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      c.tone === "primary"
                        ? "bg-primary-100 text-primary-800"
                        : "bg-secondary-100 text-secondary-800"
                    }`}
                  >
                    {"href" in c ? "Open" : "Coming soon"}
                  </span>
                  <h2 className="mt-3 text-lg font-semibold">{c.title}</h2>
                  <p className="mt-1 text-sm text-ink-muted">{c.body}</p>
                </>
              );
              return "href" in c ? (
                <Link
                  key={c.title}
                  href={c.href}
                  data-cta="dashboard_card" transitionTypes={FORWARD}
                  className="reveal rounded-2xl border border-line bg-surface p-5 transition hover:border-primary-300"
                >
                  {body}
                </Link>
              ) : (
                <div key={c.title} className="reveal rounded-2xl border border-line bg-surface p-5">
                  {body}
                </div>
              );
            })}
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
