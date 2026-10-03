import "server-only";
import { cache } from "react";
import { REMOTE_CONFIG_SETTINGS } from "@/config/app";
import { firebaseEnv, isFirebaseConfigured } from "@/config/env.public";
import { resolveRemoteConfig, type RemoteConfigKey, type RemoteConfigValues } from "@/config/remote-config";

export const REMOTE_CONFIG_TAG = "remote-config";

export type RemoteConfigSnapshot = {
  values: RemoteConfigValues;
  /** Where the values came from: the published template, or the code defaults. */
  source: "remote" | "default";
};

/**
 * Fetches the published template with the same endpoint the web SDK uses. The response
 * is cached for REMOTE_CONFIG_SETTINGS.serverRevalidateSeconds, so this costs one call per
 * minute, not one per request. Targeting by user (A/B tests, percentages) is applied in the
 * browser by RemoteConfigProvider; the server sees the values for an anonymous instance.
 */
async function fetchEntries(): Promise<Record<string, string> | null> {
  if (!isFirebaseConfigured) return null;
  const url = `https://firebaseremoteconfig.googleapis.com/v1/projects/${firebaseEnv.projectId}/namespaces/firebase:fetch?key=${firebaseEnv.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_instance_id: "server-render", app_id: firebaseEnv.appId, language_code: "en" }),
    cache: "force-cache",
    next: { revalidate: REMOTE_CONFIG_SETTINGS.serverRevalidateSeconds, tags: [REMOTE_CONFIG_TAG] },
    signal: AbortSignal.timeout(REMOTE_CONFIG_SETTINGS.serverTimeoutMs),
  });
  if (!res.ok) throw new Error(`Remote Config fetch failed: HTTP ${res.status}`);
  const body = (await res.json()) as { state?: string; entries?: Record<string, string> };
  // NO_TEMPLATE / EMPTY_CONFIG mean nothing is published yet — defaults apply.
  return body.entries ?? {};
}

/** Typed Remote Config values for this request. Never throws: falls back to defaults. */
export const getRemoteConfig = cache(async (): Promise<RemoteConfigSnapshot> => {
  try {
    const entries = await fetchEntries();
    return { values: resolveRemoteConfig(entries ?? {}), source: entries ? "remote" : "default" };
  } catch (e) {
    console.error("[remote-config] using defaults:", e instanceof Error ? e.message : e);
    return { values: resolveRemoteConfig(), source: "default" };
  }
});

export async function getRemoteValue<K extends RemoteConfigKey>(key: K): Promise<RemoteConfigValues[K]> {
  return (await getRemoteConfig()).values[key];
}
