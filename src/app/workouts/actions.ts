"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LogState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; exerciseCount: number; durationMin?: number };

type Payload = {
  date: string;
  title: string;
  durationMin: string;
  notes: string;
  exercises: { name: string; sets: { reps: string; weight: string }[] }[];
};

function toNumber(value: string) {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export async function saveWorkout(_prev: LogState, formData: FormData): Promise<LogState> {
  let payload: Payload;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return { status: "error", message: "Pick a date for this workout." };
  }

  const rows: { exercise: string; set_number: number; reps: number | null; weight_kg: number | null }[] = [];
  for (const ex of payload.exercises) {
    const name = ex.name.trim();
    if (!name) return { status: "error", message: "Every exercise needs a name." };
    let setNumber = 0;
    for (const s of ex.sets) {
      const reps = toNumber(s.reps);
      const weight = toNumber(s.weight);
      if (Number.isNaN(reps) || Number.isNaN(weight)) {
        return { status: "error", message: `Check the numbers for ${name}.` };
      }
      if (reps === null && weight === null) continue; // skip empty rows
      rows.push({ exercise: name, set_number: ++setNumber, reps: reps && Math.round(reps), weight_kg: weight });
    }
  }
  if (rows.length === 0) {
    return { status: "error", message: "Log at least one set." };
  }

  const duration = toNumber(payload.durationMin);
  const supabase = await createClient();
  const { data: workout, error } = await supabase
    .from("workouts")
    .insert({
      // Noon UTC keeps the chosen calendar day stable across time zones.
      performed_at: `${payload.date}T12:00:00Z`,
      title: payload.title.trim() || null,
      duration_min: duration && !Number.isNaN(duration) ? Math.round(duration) : null,
      notes: payload.notes.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { status: "error", message: error.message };

  const { error: setsError } = await supabase
    .from("workout_sets")
    .insert(rows.map((r) => ({ ...r, workout_id: workout.id })));
  if (setsError) {
    await supabase.from("workouts").delete().eq("id", workout.id);
    return { status: "error", message: setsError.message };
  }

  revalidatePath("/workouts");
  return {
    status: "success",
    exerciseCount: new Set(rows.map((r) => r.exercise)).size,
    durationMin: duration && !Number.isNaN(duration) ? duration : undefined,
  };
}

export async function deleteWorkout(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("workouts").delete().eq("id", id);
  revalidatePath("/workouts");
}
