/**
 * Ghost lifter: each set is compared with the same set from your last session of that exercise.
 *
 * Rules: more weight wins; at the same weight (or with no weight, e.g. bodyweight or timed
 * moves) more reps/seconds wins. Lighter but more reps doesn't count as a beat.
 */

export type GhostSet = { reps: number | null; weight: number | null };
export type GhostResult = "beat" | "matched" | "below";

function num(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Compares a set being logged with its ghost. Null when either side has nothing to compare yet. */
export function compareToGhost(
  current: { reps: string | number | null; weight: string | number | null },
  ghost: GhostSet | undefined,
): GhostResult | null {
  if (!ghost) return null;
  const reps = num(current.reps);
  if (reps === null || ghost.reps === null) return null;

  const weight = num(current.weight) ?? 0;
  const ghostWeight = ghost.weight ?? 0;
  if (weight !== ghostWeight) return weight > ghostWeight ? "beat" : "below";
  if (reps !== ghost.reps) return reps > ghost.reps ? "beat" : "below";
  return "matched";
}

/** "10 × 20 kg" style hint for a ghost set. */
export function ghostLabel(ghost: GhostSet, unit?: "seconds") {
  const r = ghost.reps === null ? "–" : unit === "seconds" ? `${ghost.reps}s` : String(ghost.reps);
  return ghost.weight ? `${r} × ${ghost.weight} kg` : r;
}
