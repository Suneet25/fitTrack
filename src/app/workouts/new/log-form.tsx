"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/firebase/analytics";
import { formatSet } from "@/lib/workouts/exercises";
import { compareToGhost, ghostLabel, type GhostResult } from "@/lib/workouts/ghost";
import type { LiveSessionInit } from "@/lib/workouts/live";
import { saveWorkout, type LogState } from "../actions";
import { startLiveSession } from "../live/actions";
import { LivePanel, SendSetButton, useLiveSession, type Me } from "./live";

/** `key` is a client-only stable id, so a set keeps its identity when others are removed. */
export type DraftSet = { reps: string; weight: string; key?: string };
export type DraftExercise = { name: string; sets: DraftSet[] };
export type LastSession = { date: string; sets: { reps: number | null; weight: number | null }[] };
type LibraryItem = { name: string; slug: string; unit?: "seconds"; bodyweight?: boolean };

const initial: LogState = { status: "idle" };
const emptySet: DraftSet = { reps: "", weight: "" };
const newKey = () => Math.random().toString(36).slice(2, 10);
const keyed = (set: DraftSet): DraftSet => ({ ...set, key: newKey() });

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const noopSubscribe = () => () => {};

export function LogForm({
  initialTitle,
  initialExercises,
  today,
  library,
  lastSessions,
  live: liveInit,
  me,
}: {
  initialTitle: string;
  initialExercises: DraftExercise[];
  /** Server's date, used until the browser's local date is known. */
  today: string;
  library: LibraryItem[];
  lastSessions: Record<string, LastSession>;
  /** Set when the form is connected to a live session (?live=CODE). */
  live: LiveSessionInit | null;
  me: Me;
}) {
  const [state, action, pending] = useActionState(saveWorkout, initial);
  const router = useRouter();

  const clientToday = useSyncExternalStore(noopSubscribe, localToday, () => today);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate ?? clientToday;

  const [title, setTitle] = useState(initialTitle);
  const [durationMin, setDurationMin] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftExercise[]>(() =>
    (initialExercises.length ? initialExercises : [{ name: "", sets: [emptySet] }]).map((ex) => ({
      ...ex,
      sets: ex.sets.map(keyed),
    })),
  );

  const live = useLiveSession(liveInit, me);
  // Sets already shared with partners: set key → live_sets row id.
  const [sent, setSent] = useState<Record<string, string>>({});
  const [liveError, setLiveError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  async function goLive() {
    setStarting(true);
    setLiveError(null);
    const result = await startLiveSession();
    setStarting(false);
    if ("error" in result) return setLiveError(result.error);
    track("live_started", {});
    const params = new URLSearchParams(searchParams.toString());
    params.set("live", result.code);
    // Same page, so the form keeps everything typed so far.
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  async function shareSet(i: number, s: number) {
    const ex = items[i];
    const set = ex.sets[s];
    const id = await live.sendSet({
      exercise: ex.name.trim(),
      setNumber: s + 1,
      reps: set.reps === "" ? null : Math.round(Number(set.reps)),
      weight: set.weight === "" ? null : Number(set.weight),
    });
    if (id && set.key) setSent((prev) => ({ ...prev, [set.key!]: id }));
    else setLiveError("Couldn't share that set. Check your connection and try again.");
  }

  /** Un-shares sets that are being removed from the form, so partners stop seeing them. */
  function unshare(sets: DraftSet[]) {
    const ids = sets.map((set) => set.key && sent[set.key]).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;
    live.removeSets(ids);
    setSent((prev) => {
      const next = { ...prev };
      for (const set of sets) if (set.key) delete next[set.key];
      return next;
    });
  }

  function removeExercise(i: number) {
    unshare(items[i].sets);
    setItems((prev) => prev.filter((_, j) => j !== i));
  }

  function removeSet(i: number, s: number) {
    unshare([items[i].sets[s]]);
    updateItem(i, (x) => ({ ...x, sets: x.sets.filter((_, k) => k !== s) }));
  }

  const unitOf = (name: string) => library.find((l) => l.name.toLowerCase() === name.trim().toLowerCase())?.unit;

  // Sets that beat their ghost, counted when the form is submitted.
  const ghostBeatsAtSubmit = useRef(0);

  useEffect(() => {
    if (state.status !== "success") return;
    track("workout_logged", { exercise_count: state.exerciseCount, duration_min: state.durationMin });
    if (ghostBeatsAtSubmit.current > 0) track("ghost_beaten", { sets: ghostBeatsAtSubmit.current });
    router.push("/workouts");
  }, [state, router]);

  const updateItem = (i: number, fn: (ex: DraftExercise) => DraftExercise) =>
    setItems((prev) => prev.map((ex, j) => (j === i ? fn(ex) : ex)));

  const updateSet = (i: number, s: number, patch: Partial<DraftSet>) =>
    updateItem(i, (ex) => ({ ...ex, sets: ex.sets.map((set, k) => (k === s ? { ...set, ...patch } : set)) }));

  const payload = JSON.stringify({ date, title, durationMin, notes, exercises: items });

  const ghostOf = (ex: DraftExercise) => lastSessions[ex.name.trim().toLowerCase()]?.sets;
  const totalBeats = items.reduce(
    (sum, ex) => sum + ex.sets.filter((set, k) => compareToGhost(set, ghostOf(ex)?.[k]) === "beat").length,
    0,
  );

  return (
    <form
      action={action}
      onSubmit={() => {
        ghostBeatsAtSubmit.current = totalBeats;
      }}
      className="mt-6 space-y-6"
    >
      <input type="hidden" name="payload" value={payload} />

      <div className="grid grid-cols-[3fr_2fr] gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_2fr_1fr] sm:p-5">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setPickedDate(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Title (optional)" className="order-first col-span-2 sm:order-0 sm:col-span-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Push day"
            className={inputClass}
          />
        </Field>
        <Field label="Minutes">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {liveInit ? (
        <LivePanel live={live} init={liveInit} me={me} unit={unitOf} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line p-4">
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-ink">Training with a friend somewhere else?</span> Go live and see each
            other&apos;s sets as they happen.
          </p>
          <button
            type="button"
            onClick={goLive}
            disabled={starting}
            data-cta="live_start"
            className="rounded-lg border border-primary-600 px-3 py-1.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 disabled:opacity-60 dark:text-primary-400"
          >
            {starting ? "Starting…" : "👥 Go live"}
          </button>
        </div>
      )}
      {liveError && (
        <p role="alert" className="rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-800">
          {liveError}
        </p>
      )}

      <datalist id="exercise-library">
        {library.map((e) => (
          <option key={e.slug} value={e.name} />
        ))}
      </datalist>

      {items.map((ex, i) => {
        const info = library.find((l) => l.name.toLowerCase() === ex.name.trim().toLowerCase());
        const last = lastSessions[ex.name.trim().toLowerCase()];
        const repsLabel = info?.unit === "seconds" ? "Seconds" : "Reps";
        const results = ex.sets.map((set, k) => compareToGhost(set, last?.sets[k]));
        const compared = results.filter((r) => r !== null).length;
        const beats = results.filter((r) => r === "beat").length;
        return (
          <section key={i} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <label className="flex-1">
                <span className="sr-only">Exercise</span>
                <input
                  list="exercise-library"
                  value={ex.name}
                  onChange={(e) => updateItem(i, (x) => ({ ...x, name: e.target.value }))}
                  placeholder="Exercise — pick from the list or type your own"
                  className={`${inputClass} font-semibold`}
                />
              </label>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExercise(i)}
                  className="mt-2.5 text-sm text-ink-muted hover:text-secondary-700 dark:hover:text-secondary-400"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              {info && (
                <Link href={`/workouts/learn/${info.slug}`} target="_blank" data-cta="exercise_open" className="hover:text-primary-700 dark:hover:text-primary-400 hover:underline">
                  How to do it ↗
                </Link>
              )}
              {last && (
                <>
                  <span title={`Your ghost is your last session (${last.date})`}>
                    👻 Ghost: {last.sets.map((s) => formatSet(s.reps, s.weight, info?.unit)).join(", ")}
                  </span>
                  {compared > 0 && (
                    <span
                      key={beats}
                      className={`ghost-pop rounded-full px-2 py-0.5 font-semibold ${
                        beats > 0 ? "bg-primary-100 text-primary-800" : "bg-surface-muted text-ink-muted"
                      }`}
                    >
                      {beats}/{compared} beaten
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      // Replaces this exercise's sets, so any already shared are withdrawn.
                      unshare(ex.sets);
                      updateItem(i, (x) => ({
                        ...x,
                        sets: last.sets.map((s) =>
                          keyed({ reps: s.reps?.toString() ?? "", weight: s.weight?.toString() ?? "" }),
                        ),
                      }));
                    }}
                    data-cta="workout_copy_last"
                    className="font-medium text-primary-700 dark:text-primary-400 hover:underline"
                  >
                    Copy
                  </button>
                </>
              )}
            </div>

            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="w-12 pb-2 font-medium">Set</th>
                  <th className="pb-2 font-medium">{repsLabel}</th>
                  <th className="pb-2 pl-3 font-medium">Weight (kg){info?.bodyweight ? " — optional" : ""}</th>
                  {live.active && <th className="w-10" />}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {ex.sets.map((set, s) => (
                  <tr key={set.key ?? s} className={rowTone[results[s] ?? "none"]}>
                    <td className="py-1 pl-1 font-medium tabular-nums text-ink-muted">
                      <GhostMark set={s + 1} result={results[s]} ghost={last?.sets[s] && ghostLabel(last.sets[s], info?.unit)} />
                    </td>
                    <td className="py-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label={`Set ${s + 1} ${repsLabel.toLowerCase()}`}
                        value={set.reps}
                        placeholder={last?.sets[s]?.reps?.toString() ?? ""}
                        onChange={(e) => updateSet(i, s, { reps: e.target.value })}
                        className={`${inputClass} tabular-nums`}
                      />
                    </td>
                    <td className="py-1 pl-3">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        aria-label={`Set ${s + 1} weight in kg`}
                        value={set.weight}
                        placeholder={last?.sets[s]?.weight?.toString() ?? ""}
                        onChange={(e) => updateSet(i, s, { weight: e.target.value })}
                        className={`${inputClass} tabular-nums`}
                      />
                    </td>
                    {live.active && (
                      <td className="py-1 pl-2">
                        <SendSetButton
                          ready={ex.name.trim() !== "" && set.reps !== ""}
                          sent={Boolean(set.key && sent[set.key])}
                          onSend={() => shareSet(i, s)}
                        />
                      </td>
                    )}
                    <td className="py-1 text-right">
                      {ex.sets.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove set ${s + 1}`}
                          onClick={() => removeSet(i, s)}
                          className="px-2 text-ink-muted hover:text-secondary-700 dark:hover:text-secondary-400"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              data-cta="workout_add_set"
              type="button"
              // New sets start as a copy of the previous one — most people repeat the same numbers.
              onClick={() => updateItem(i, (x) => ({ ...x, sets: [...x.sets, keyed(x.sets.at(-1) ?? emptySet)] }))}
              className="mt-3 text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline"
            >
              + Add set
            </button>
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, { name: "", sets: [keyed(emptySet)] }])}
        data-cta="workout_add_exercise"
        className="w-full rounded-2xl border-2 border-dashed border-line py-4 font-medium text-ink-muted transition hover:border-primary-300 hover:text-primary-700 dark:hover:text-primary-400"
      >
        + Add exercise
      </button>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="How did it feel?"
          className={inputClass}
        />
      </Field>

      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-800">
          {state.message}
        </p>
      )}

      {/* Pinned to the bottom of the screen on phones, where the form gets long. */}
      <div data-cta="workout_save" className="sticky bottom-0 -mx-4 border-t border-line bg-surface-muted/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-primary-600 py-3 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save workout"}
        </button>
      </div>
    </form>
  );
}

const rowTone: Record<GhostResult | "none", string> = {
  beat: "bg-primary-50 dark:bg-primary-950/40",
  matched: "bg-surface-muted",
  below: "",
  none: "",
};

/** Set number, plus how it compares with the ghost. */
function GhostMark({ set, result, ghost }: { set: number; result: GhostResult | null; ghost?: string }) {
  const tip = ghost ? `Ghost: ${ghost}` : "No ghost for this set";
  if (result === "beat") {
    return (
      <span key="beat" title={tip} className="ghost-pop inline-flex items-center gap-0.5 text-primary-700 dark:text-primary-400">
        {set}
        <span aria-label="beat your ghost">▲</span>
      </span>
    );
  }
  if (result === "matched") {
    return (
      <span title={tip}>
        {set}
        <span className="ml-0.5" aria-label="matched your ghost">=</span>
      </span>
    );
  }
  return <span title={tip}>{set}</span>;
}

// text-base (16px) on phones stops iOS Safari zooming in when an input is focused.
const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base outline-none placeholder:text-ink-muted/45 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 sm:text-sm";

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
