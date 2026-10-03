import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { firebaseEnv, isAnalyticsConfigured } from "@/config/env.public";

export { isFirebaseConfigured } from "@/config/env.public";

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseEnv);
}

let analyticsPromise: Promise<Analytics | null> | null = null;

/**
 * Lazily creates the Analytics instance. Returns null on the server, when
 * Firebase env vars are missing, or when the browser doesn't support it
 * (e.g. some privacy modes) — so callers never have to guard.
 */
export function getAnalyticsInstance(): Promise<Analytics | null> {
  if (typeof window === "undefined" || !isAnalyticsConfigured) {
    return Promise.resolve(null);
  }
  analyticsPromise ??= isSupported()
    .then((ok) => (ok ? getAnalytics(getFirebaseApp()) : null))
    .catch(() => null);
  return analyticsPromise;
}
