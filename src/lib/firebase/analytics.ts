"use client";

import { logEvent, setUserId } from "firebase/analytics";
import { getAnalyticsInstance } from "./client";

/**
 * Every custom event the app sends, with its parameters.
 * Add new events here so names stay consistent across the codebase.
 */
export type AppEvents = {
  sign_up: { method: "email" | "google" };
  login: { method: "email" | "google" };
  logout: Record<string, never>;
  workout_logged: { exercise_count: number; duration_min?: number };
  meal_logged: { calories?: number; meal_type?: string };
  chat_opened: Record<string, never>;
  chat_message_sent: { length: number };
  goal_set: { goal_type: string };
  activity_synced: { source: "strava" | "google_fit"; count: number };
};

/** Log a typed analytics event. No-ops when analytics is unavailable. */
export async function track<E extends keyof AppEvents>(
  event: E,
  params?: AppEvents[E],
) {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  logEvent(analytics, event as string, params as Record<string, unknown>);
}

/** Log a page view (called automatically on route change). */
export async function trackPageView(path: string) {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  logEvent(analytics, "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/** Tie events to the signed-in user (pass null on logout). */
export async function identify(userId: string | null) {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  setUserId(analytics, userId);
}
