"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { track } from "@/lib/firebase/analytics";
import { formatSet } from "@/lib/workouts/exercises";
import { saveWorkout, type LogState } from "../actions";

export type DraftSet = { reps: string; weight: string };
export type DraftExercise = { name: string; sets: DraftSet[] };
export type LastSession = { date: string; sets: { reps: number | null; weight: number | null }[] };
type LibraryItem = { name: string; slug: string; unit?: "seconds"; bodyweight?: boolean };

const initial: LogState = { status: "idle" };
const emptySet: DraftSet = { reps: "", weight: "" };

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
}: {
  initialTitle: string;
  initialExercises: DraftExercise[];
  /** Server's date, used until the browser's local date is known. */
  today: string;
  library: LibraryItem[];
  lastSessions: Record<string, LastSession>;
}) {
  const [state, action, pending] = useActionState(saveWorkout, initial);
  const router = useRouter();

  const clientToday = useSyncExternalStore(noopSubscribe, localToday, () => today);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate ?? clientToday;

  const [title, setTitle] = useState(initialTitle);
  const [durationMin, setDurationMin] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftExercise[]>(
    initialExercises.length ? initialExercises : [{ name: "", sets: [{ ...emptySet }] }],
  );

  useEffect(() => {
    if (state.status !== "success") return;
    track("workout_logged", { exercise_count: state.exerciseCount, duration_min: state.durationMin });
    router.push("/workouts");
  }, [state, router]);

  const updateItem = (i: number, fn: (ex: DraftExercise) => DraftExercise) =>
    setItems((prev) => prev.map((ex, j) => (j === i ? fn(ex) : ex)));

  const updateSet = (i: number, s: number, patch: Partial<DraftSet>) =>
    updateItem(i, (ex) => ({ ...ex, sets: ex.sets.map((set, k) => (k === s ? { ...set, ...patch } : set)) }));

  const payload = JSON.stringify({ date, title, durationMin, notes, exercises: items });

  return (
    <form action={action} className="mt-6 space-y-6">
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

      <datalist id="exercise-library">
        {library.map((e) => (
          <option key={e.slug} value={e.name} />
        ))}
      </datalist>

      {items.map((ex, i) => {
        const info = library.find((l) => l.name.toLowerCase() === ex.name.trim().toLowerCase());
        const last = lastSessions[ex.name.trim().toLowerCase()];
        const repsLabel = info?.unit === "seconds" ? "Seconds" : "Reps";
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
                  onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
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
                  <span>
                    Last time: {last.sets.map((s) => formatSet(s.reps, s.weight, info?.unit)).join(", ")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateItem(i, (x) => ({
                        ...x,
                        sets: last.sets.map((s) => ({
                          reps: s.reps?.toString() ?? "",
                          weight: s.weight?.toString() ?? "",
                        })),
                      }))
                    }
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
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {ex.sets.map((set, s) => (
                  <tr key={s}>
                    <td className="py-1 font-medium tabular-nums text-ink-muted">{s + 1}</td>
                    <td className="py-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label={`Set ${s + 1} ${repsLabel.toLowerCase()}`}
                        value={set.reps}
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
                        onChange={(e) => updateSet(i, s, { weight: e.target.value })}
                        className={`${inputClass} tabular-nums`}
                      />
                    </td>
                    <td className="py-1 text-right">
                      {ex.sets.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove set ${s + 1}`}
                          onClick={() => updateItem(i, (x) => ({ ...x, sets: x.sets.filter((_, k) => k !== s) }))}
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
              onClick={() => updateItem(i, (x) => ({ ...x, sets: [...x.sets, { ...(x.sets.at(-1) ?? emptySet) }] }))}
              className="mt-3 text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline"
            >
              + Add set
            </button>
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, { name: "", sets: [{ ...emptySet }] }])}
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

// text-base (16px) on phones stops iOS Safari zooming in when an input is focused.
const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 sm:text-sm";

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
