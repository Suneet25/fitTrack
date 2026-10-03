import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.appId && firebaseConfig.measurementId,
);

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let analyticsPromise: Promise<Analytics | null> | null = null;

/**
 * Lazily creates the Analytics instance. Returns null on the server, when
 * Firebase env vars are missing, or when the browser doesn't support it
 * (e.g. some privacy modes) — so callers never have to guard.
 */
export function getAnalyticsInstance(): Promise<Analytics | null> {
  if (typeof window === "undefined" || !isFirebaseConfigured) {
    return Promise.resolve(null);
  }
  analyticsPromise ??= isSupported()
    .then((ok) => (ok ? getAnalytics(getFirebaseApp()) : null))
    .catch(() => null);
  return analyticsPromise;
}
