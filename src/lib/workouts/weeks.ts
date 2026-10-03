const DAY_MS = 24 * 60 * 60 * 1000;

/** Workouts are stored at noon UTC on the day they were done, so the UTC date is the training day. */
export function toDateString(timestamp: string) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Monday (UTC midnight) of the week containing `date` (YYYY-MM-DD). */
export function mondayOf(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const dayFromMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - dayFromMonday * DAY_MS);
}

/** Training week number, counting the week of the user's first workout as Week 1. */
export function weekNumber(firstDate: string, date: string) {
  return Math.floor((mondayOf(date).getTime() - mondayOf(firstDate).getTime()) / (7 * DAY_MS)) + 1;
}

export function formatWeekRange(date: string) {
  const start = mondayOf(date);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
