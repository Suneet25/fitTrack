import Link from "next/link";
import { redirect } from "next/navigation";
import { Lottie } from "@/components/lottie";
import { PageTransition } from "@/components/page-transition";
import { createClient } from "@/lib/supabase/server";
import { parseLiveCode } from "@/lib/workouts/live";
import { joinLiveSession } from "../actions";

/** Invite link landing: says whose session it is and asks before joining. */
export default async function JoinLivePage({ params, searchParams }: PageProps<"/workouts/live/[code]">) {
  const { code: raw } = await params;
  const { error } = await searchParams;
  const code = parseLiveCode(raw);
  // Tidy links that arrived with extra text, so the address bar shows the clean invite.
  if (code && code !== raw) redirect(`/workouts/live/${code}${typeof error === "string" ? `?error=${encodeURIComponent(error)}` : ""}`);

  const supabase = await createClient();
  const { data } = code ? await supabase.rpc("live_session_preview", { share_code: code }) : { data: null };
  const preview = (data as { host_name: string; member_count: number; active: boolean }[] | null)?.[0];

  return (
    <PageTransition>
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-6 text-center">
        <Lottie src="/lottie/hero-lift.json" className="mx-auto h-32 w-32" />
        {preview?.active ? (
          <>
            <h1 className="text-xl font-bold tracking-tight">Train with {preview.host_name}</h1>
            <p className="mt-2 text-sm text-ink-muted">
              {preview.member_count} {preview.member_count === 1 ? "person is" : "people are"} in this live workout. You&apos;ll
              see each other&apos;s sets as they happen, and each log your own workout.
            </p>
            {typeof error === "string" && (
              <p role="alert" className="mt-4 rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-800">
                {error}
              </p>
            )}
            <form action={joinLiveSession} data-cta="live_join" className="mt-5">
              <input type="hidden" name="code" value={code ?? ""} />
              <button
                type="submit"
                className="w-full rounded-lg bg-primary-600 py-3 font-semibold text-white transition hover:bg-primary-700"
              >
                Join live workout
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold tracking-tight">This live workout has ended</h1>
            <p className="mt-2 text-sm text-ink-muted">Live sessions last 6 hours. Ask your friend for a new link.</p>
            <Link href="/workouts/new" className="mt-5 inline-block font-semibold text-primary-700 hover:underline">
              Log a workout on your own →
            </Link>
          </>
        )}
      </div>
    </PageTransition>
  );
}
