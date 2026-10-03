import data from "./exercises.json";

/**
 * Exercise library. Photos and instructions come from free-exercise-db
 * (public domain, github.com/yuhonas/free-exercise-db).
 */
export type MuscleGroup = "legs" | "back" | "chest" | "shoulders" | "arms" | "core";

export type Exercise = {
  slug: string;
  name: string;
  group: MuscleGroup;
  level: string;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  /** Start and end position photos, relative to IMAGE_BASE. */
  images: string[];
  instructions: string[];
  /**
   * Optional demo clip, e.g. "/videos/barbell-back-squat.mp4" in /public.
   * Without one, the start and end photos are animated into a loop instead.
   */
  demoVideo?: string;
  /** Logged as seconds instead of reps (e.g. plank). */
  unit?: "seconds";
  /** Weight is optional — usually just bodyweight. */
  bodyweight?: boolean;
};

export const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

export const exercises = data as Exercise[];

export const muscleGroups: { id: MuscleGroup; label: string }[] = [
  { id: "legs", label: "Legs" },
  { id: "back", label: "Back" },
  { id: "chest", label: "Chest" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "core", label: "Core" },
];

export function getExercise(slug: string) {
  return exercises.find((e) => e.slug === slug);
}

export function findExerciseByName(name: string) {
  const n = name.trim().toLowerCase();
  return exercises.find((e) => e.name.toLowerCase() === n);
}

export function imageUrl(path: string) {
  return `${IMAGE_BASE}/${path}`;
}

export type PlanDay = {
  id: string;
  name: string;
  items: { slug: string; sets: number; reps: number }[];
};

/**
 * A simple full-body starter plan: alternate A and B, three days a week
 * (A-B-A one week, B-A-B the next). Add a little weight when every set hits the target reps.
 */
export const starterPlan: PlanDay[] = [
  {
    id: "a",
    name: "Full body A",
    items: [
      { slug: "goblet-squat", sets: 3, reps: 10 },
      { slug: "push-up", sets: 3, reps: 10 },
      { slug: "lat-pulldown", sets: 3, reps: 10 },
      { slug: "dumbbell-shoulder-press", sets: 3, reps: 10 },
      { slug: "plank", sets: 3, reps: 30 },
    ],
  },
  {
    id: "b",
    name: "Full body B",
    items: [
      { slug: "romanian-deadlift", sets: 3, reps: 10 },
      { slug: "incline-dumbbell-press", sets: 3, reps: 10 },
      { slug: "seated-cable-row", sets: 3, reps: 10 },
      { slug: "dumbbell-lunge", sets: 3, reps: 10 },
      { slug: "dumbbell-curl", sets: 2, reps: 12 },
    ],
  },
];

/** "10 × 20 kg", "10" (no weight) or "30s" for timed exercises. */
export function formatSet(reps: number | null, weight: number | null, unit?: "seconds") {
  const r = reps === null ? "–" : unit === "seconds" ? `${reps}s` : `${reps}`;
  return weight ? `${r} × ${weight} kg` : r;
}
