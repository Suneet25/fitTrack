import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

const cards = [
  { title: "Workouts", body: "Log exercises, sets, reps and weight.", tone: "primary" },
  { title: "Diet", body: "Track meals, calories and macros.", tone: "secondary" },
  { title: "Progress", body: "Charts of your trends over time.", tone: "primary" },
  { title: "AI Coach", body: "Chat about your data with your own API key.", tone: "secondary" },
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  // getUser() verifies with Supabase Auth — the real check (proxy is only optimistic).
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?next=/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Fit<span className="text-primary-600">Track</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-muted sm:inline">{data.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-ink-muted">Here&apos;s where your training and nutrition will live.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.title} className="rounded-2xl border border-line bg-surface p-5">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  c.tone === "primary"
                    ? "bg-primary-100 text-primary-800"
                    : "bg-secondary-100 text-secondary-800"
                }`}
              >
                Coming soon
              </span>
              <h2 className="mt-3 text-lg font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
