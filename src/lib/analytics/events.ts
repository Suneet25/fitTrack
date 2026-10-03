/**
 * Analytics event catalog — the one place to see and change what FitTrack tracks.
 *
 * CTAs: put `data-cta="<id>"` on a button or link (or on a <form> around its submit
 * button) and a click sends the event configured below. Clicks on buttons and links
 * that aren't listed still send a generic `cta_click`, so nothing goes untracked.
 *
 * GA4 rules: event and param names are snake_case, at most 40 characters, and must
 * not start with a number, `ga_`, `google_` or `firebase_`.
 */

export type CtaConfig = {
  /** GA4 event name sent on click. */
  event: string;
  /** What the CTA is, shown in the event inspector. */
  description: string;
  /** Extra fixed params sent with the event. */
  params?: Record<string, string | number>;
};

export const CTAS = {
  // Landing page
  home_get_started: { event: "sign_up_started", description: "Landing hero “Get started”", params: { location: "hero" } },
  home_sign_in: { event: "login_started", description: "Landing header “Sign in”", params: { location: "header" } },
  home_go_to_dashboard: { event: "cta_click", description: "Landing hero “Go to dashboard”" },

  // Auth
  auth_tab_login: { event: "cta_click", description: "Login form: “Log in” tab" },
  auth_tab_signup: { event: "cta_click", description: "Login form: “Sign up” tab" },
  auth_submit_login: { event: "login_submitted", description: "Email login submitted", params: { method: "email" } },
  auth_submit_signup: { event: "sign_up_submitted", description: "Email sign-up submitted", params: { method: "email" } },
  auth_google: { event: "login_started", description: "“Continue with Google”", params: { method: "google" } },
  auth_toggle_password: { event: "cta_click", description: "Show/hide password eye icon" },
  sign_out: { event: "cta_click", description: "Header “Sign out”" },
  theme_toggle: { event: "theme_changed", description: "Theme switcher (system/light/dark)" },

  // Navigation
  nav_home: { event: "nav_click", description: "Header nav: Home", params: { destination: "dashboard" } },
  nav_workouts: { event: "nav_click", description: "Header nav: Workouts", params: { destination: "workouts" } },
  nav_learn: { event: "nav_click", description: "Header nav: Learn", params: { destination: "learn" } },
  nav_activity: { event: "nav_click", description: "Header nav: Activity", params: { destination: "activity" } },
  dashboard_card: { event: "dashboard_card_click", description: "Dashboard feature card" },

  // Workouts
  workout_log_start: { event: "workout_log_started", description: "“Log workout” / “Log a workout”" },
  workout_learn_start: { event: "cta_click", description: "Empty state “Learn the exercises”" },
  workout_delete: { event: "workout_deleted", description: "Delete a logged workout" },
  workout_save: { event: "workout_save_clicked", description: "“Save workout” on the log form" },
  workout_add_exercise: { event: "cta_click", description: "Log form: “+ Add exercise”" },
  workout_add_set: { event: "cta_click", description: "Log form: “+ Add set”" },
  workout_copy_last: { event: "cta_click", description: "Log form: copy last session's sets" },
  plan_start: { event: "plan_started", description: "Learn: start a beginner plan day" },
  exercise_open: { event: "exercise_viewed", description: "Open an exercise from the library" },
  exercise_filter: { event: "cta_click", description: "Learn: muscle group filter chip" },
  exercise_log: { event: "workout_log_started", description: "Exercise page “Log this exercise”", params: { from: "exercise" } },

  // Activity / Google Health
  health_connect: { event: "health_connect_started", description: "“Connect Google account”" },
  health_allow_more: { event: "health_connect_started", description: "“Allow access” for sleep & heart", params: { upgrade: 1 } },
  health_sync: { event: "health_sync_clicked", description: "Activity “Sync now”" },
  health_disconnect: { event: "health_disconnected", description: "Activity “Disconnect”" },
  activity_chart_metric: { event: "cta_click", description: "Activity chart metric chip" },

  // Remote Config driven
  announcement_banner: { event: "announcement_clicked", description: "Site-wide announcement banner link" },
} as const satisfies Record<string, CtaConfig>;

export type CtaId = keyof typeof CTAS;

/** Typed helper for JSX: `<button {...cta("workout_save")}>` */
export function cta(id: CtaId) {
  return { "data-cta": id };
}

/**
 * Events sent from code (not clicks), e.g. after a server action succeeds.
 * Listed here so the catalog shows everything the app can send.
 */
export const CODE_EVENTS = {
  page_view: "Every route change",
  login: "Login succeeded (method: email | google)",
  sign_up: "Sign-up succeeded",
  logout: "Signed out",
  workout_logged: "Workout saved (exercise_count, duration_min)",
} as const;
