"use client";

import { logEvent, setUserId } from "firebase/analytics";
import { CTAS, type CtaId } from "@/lib/analytics/events";
import { getAnalyticsInstance } from "./client";

/**
 * Every custom event the app sends from code, with its parameters.
 * Click (CTA) events are configured in src/lib/analytics/events.ts instead.
 */
export type AppEvents = {
  sign_up: { method: "email" | "google" };
  login: { method: "email" | "google" };
  logout: Record<string, never>;
  workout_logged: { exercise_count: number; duration_min?: number };
  ghost_beaten: { sets: number };
  live_started: Record<string, never>;
  live_set_sent: { set_number: number };
  live_cheer_sent: Record<string, never>;
  meal_logged: { calories?: number; meal_type?: string };
  chat_opened: Record<string, never>;
  chat_message_sent: { length: number };
  goal_set: { goal_type: string };
  activity_synced: { source: "strava" | "google_fit"; count: number };
};

type Params = Record<string, unknown>;

// --- Local event log, read by the in-app event inspector ---------------------

export type LoggedEvent = { id: number; name: string; params: Params; at: number; sent: boolean };

const MAX_LOG = 100;
let log: LoggedEvent[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

export const eventLog = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => log,
  clear() {
    log = [];
    listeners.forEach((fn) => fn());
  },
};

/** Sends one event to GA (when configured) and records it in the local log. */
async function send(name: string, params: Params = {}) {
  const analytics = await getAnalyticsInstance();
  if (analytics) {
    // debug_mode makes development events show up in Firebase → Analytics → DebugView.
    const extra = process.env.NODE_ENV === "development" ? { debug_mode: true } : {};
    logEvent(analytics, name, { ...params, ...extra });
  }
  log = [{ id: nextId++, name, params, at: Date.now(), sent: Boolean(analytics) }, ...log].slice(0, MAX_LOG);
  listeners.forEach((fn) => fn());
}

// --- Public API ----------------------------------------------------------------

/** Log a typed analytics event. Not sent to GA when analytics is unavailable. */
export function track<E extends keyof AppEvents>(event: E, params?: AppEvents[E]) {
  return send(event, params);
}

/** Log a click on a CTA: its configured event, or a generic `cta_click` when `id` isn't in the catalog. */
export function trackCta(id: string | null, label: string, href?: string) {
  const config = id && id in CTAS ? CTAS[id as CtaId] : undefined;
  if (id && !config && process.env.NODE_ENV === "development") {
    console.warn(`[analytics] data-cta="${id}" isn't in src/lib/analytics/events.ts; sent as cta_click.`);
  }
  return send(config?.event ?? "cta_click", {
    cta_id: config ? id : "unlisted",
    cta_text: label.slice(0, 100),
    ...(href ? { link_url: href.slice(0, 100) } : {}),
    page_path: window.location.pathname,
    ...(config && "params" in config ? config.params : {}),
  });
}

/** Log a page view (called automatically on route change). */
export function trackPageView(path: string) {
  return send("page_view", {
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
