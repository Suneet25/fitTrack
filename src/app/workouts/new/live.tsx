"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { track } from "@/lib/firebase/analytics";
import { createClient } from "@/lib/supabase/client";
import { formatSet } from "@/lib/workouts/exercises";
import type { LiveMember, LiveSessionInit, LiveSet } from "@/lib/workouts/live";

export type Me = { id: string; name: string };

const subscribeClock = (fn: () => void) => {
  const t = setInterval(fn, 30_000);
  return () => clearInterval(t);
};

/**
 * Live session state over Supabase Realtime:
 * - new sets and members arrive through Postgres changes (RLS: members only),
 * - who's online through Presence,
 * - 💪 cheers through Broadcast.
 */
export function useLiveSession(init: LiveSessionInit | null, me: Me) {
  const supabase = useMemo(() => createClient(), []);
  const [sets, setSets] = useState<LiveSet[]>(init?.sets ?? []);
  const [members, setMembers] = useState<LiveMember[]>(init?.members ?? []);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const channel = useRef<RealtimeChannel | null>(null);
  const sessionId = init?.sessionId;

  // Re-evaluated every 30 s so the panel notices when the session expires.
  const now = useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 30_000), () => 0);
  const ended = init ? now > 0 && Date.parse(init.expiresAt) < now * 30_000 : false;

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      // Realtime needs the user's JWT so the RLS policies can tell who's listening.
      await supabase.auth.getSession();
      await supabase.realtime.setAuth();
      if (cancelled) return;

      const ch = supabase
        .channel(`live:${sessionId}`, { config: { presence: { key: me.id } } })
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "live_sets", filter: `session_id=eq.${sessionId}` },
          ({ new: row }) => setSets((prev) => (prev.some((s) => s.id === row.id) ? prev : [...prev, row as LiveSet])),
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "live_session_members", filter: `session_id=eq.${sessionId}` },
          ({ new: row }) =>
            setMembers((prev) => (prev.some((m) => m.user_id === row.user_id) ? prev : [...prev, row as LiveMember])),
        )
        // Removals come over the session channel: Postgres DELETE events can't be filtered per session.
        .on("broadcast", { event: "sets_removed" }, ({ payload }) => {
          const ids = new Set<string>(Array.isArray(payload?.ids) ? payload.ids : []);
          setSets((prev) => prev.filter((s) => !ids.has(s.id)));
        })
        .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
        .on("broadcast", { event: "cheer" }, ({ payload }) => {
          if (payload?.to !== me.id) return;
          setToast(`${String(payload.from).slice(0, 40)} cheered you on 💪`);
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => setToast(null), 3000);
        })
        .subscribe(async (status) => {
          setConnected(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED") await ch.track({ name: me.name });
        });
      channel.current = ch;
    })();

    return () => {
      cancelled = true;
      clearTimeout(toastTimer);
      if (channel.current) supabase.removeChannel(channel.current);
      channel.current = null;
    };
  }, [sessionId, me.id, me.name, supabase]);

  /** Shares a set with partners. Returns the live row id, or null if it failed. */
  async function sendSet(set: { exercise: string; setNumber: number; reps: number | null; weight: number | null }) {
    if (!sessionId) return null;
    const { data, error } = await supabase
      .from("live_sets")
      .insert({
        session_id: sessionId,
        exercise: set.exercise.slice(0, 80),
        set_number: set.setNumber,
        reps: set.reps,
        weight_kg: set.weight,
      })
      .select("id, user_id, exercise, set_number, reps, weight_kg, created_at")
      .single();
    if (error || !data) return null;
    setSets((prev) => (prev.some((s) => s.id === data.id) ? prev : [...prev, data as LiveSet]));
    track("live_set_sent", { set_number: set.setNumber });
    return data.id as string;
  }

  /** Withdraws shared sets: deletes them (RLS: own sets only) and tells partners right away. */
  async function removeSets(ids: string[]) {
    if (!sessionId || ids.length === 0) return;
    const gone = new Set(ids);
    setSets((prev) => prev.filter((s) => !gone.has(s.id)));
    const { error } = await supabase.from("live_sets").delete().in("id", ids);
    // Only tell partners once it's really gone; otherwise their view would disagree with the database.
    if (!error) channel.current?.send({ type: "broadcast", event: "sets_removed", payload: { ids } });
  }

  function cheer(to: LiveMember) {
    channel.current?.send({ type: "broadcast", event: "cheer", payload: { from: me.name, to: to.user_id } });
    track("live_cheer_sent", {});
  }

  return { active: Boolean(init) && !ended, ended, connected, sets, members, online, toast, sendSet, removeSets, cheer };
}

export type LiveApi = ReturnType<typeof useLiveSession>;

/** Share link, partners' latest sets, who's online and cheers. */
export function LivePanel({ live, init, me, unit }: { live: LiveApi; init: LiveSessionInit; me: Me; unit: (exercise: string) => "seconds" | undefined }) {
  const [copied, setCopied] = useState(false);
  const partners = live.members.filter((m) => m.user_id !== me.id);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/workouts/live/${init.code}`;

  async function share() {
    if (navigator.share) {
      // URL only: some share targets join `text` and `url` into one string, which breaks the link.
      await navigator.share({ title: "Train with me on FitTrack", url: link }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-2xl border border-primary-200 bg-primary-50 p-4 text-primary-950 sm:p-5 dark:border-primary-800/50 dark:bg-primary-950/30 dark:text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${live.ended ? "bg-ink-muted" : live.connected ? "live-dot bg-primary-500" : "bg-secondary-400"}`} />
          <h2 className="font-semibold">{live.ended ? "Live workout ended" : "Live workout"}</h2>
          <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-xs tracking-widest text-ink">{init.code}</span>
        </div>
        {!live.ended && (
          <button
            type="button"
            onClick={share}
            data-cta="live_share"
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            {copied ? "Link copied ✓" : "Invite a friend"}
          </button>
        )}
      </div>

      {partners.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">
          {live.ended
            ? "Start a new live workout to train with someone again."
            : "Send the invite link to a friend. When they join, you'll see their sets here as they log them, and they'll see yours."}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {partners.map((p) => {
            const theirs = live.sets.filter((s) => s.user_id === p.user_id);
            const latest = theirs.at(-1);
            // Their exercises in the order they started them, newest last; show the last two.
            const exercises = [...new Set(theirs.map((s) => s.exercise))].slice(-2);
            const isOnline = live.online.has(p.user_id);
            return (
              <li key={p.user_id} className="rounded-xl bg-surface p-3 text-ink">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {p.display_name}{" "}
                    <span className={`text-xs font-normal ${isOnline ? "text-primary-700 dark:text-primary-400" : "text-ink-muted"}`}>
                      {isOnline ? "● training now" : "○ away"}
                    </span>
                  </p>
                  {!live.ended && (
                    <button
                      type="button"
                      onClick={() => live.cheer(p)}
                      disabled={!isOnline}
                      data-cta="live_cheer"
                      aria-label={`Cheer ${p.display_name} on`}
                      className="rounded-full border border-line px-2.5 py-1 text-sm transition hover:border-primary-400 disabled:opacity-40"
                    >
                      💪
                    </button>
                  )}
                </div>
                {exercises.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-muted">No sets yet.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {exercises.map((name) => (
                      <li key={name} className="flex flex-wrap gap-x-2">
                        <span className="font-medium">{name}</span>
                        <span className="tabular-nums text-ink-muted">
                          {theirs
                            .filter((s) => s.exercise === name)
                            .map((s) => (
                              <span key={s.id} className={s.id === latest?.id ? "ghost-pop inline-block font-semibold text-primary-700 dark:text-primary-400" : ""}>
                                {formatSet(s.reps, s.weight_kg, unit(name))}
                              </span>
                            ))
                            .reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {live.toast && (
        <div role="status" className="ghost-pop fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface shadow-lg sm:bottom-8">
          {live.toast}
        </div>
      )}
    </section>
  );
}

/** Small ✓ button on each set row in a live workout: sends the set to partners. */
export function SendSetButton({ ready, sent, onSend }: { ready: boolean; sent: boolean; onSend: () => void }) {
  return (
    <button
      type="button"
      onClick={onSend}
      disabled={!ready || sent}
      data-cta="live_send_set"
      aria-label={sent ? "Set shared with your partner" : "Share this set with your partner"}
      title={sent ? "Shared" : "Done — share with partner"}
      className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm transition ${
        sent
          ? "ghost-pop border-primary-600 bg-primary-600 text-white"
          : "border-line text-ink-muted hover:border-primary-400 hover:text-primary-700 disabled:opacity-40"
      }`}
    >
      ✓
    </button>
  );
}
