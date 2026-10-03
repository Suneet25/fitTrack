"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { REMOTE_CONFIG_SETTINGS } from "@/config/app";
import { isFirebaseConfigured } from "@/config/env.public";
import {
  REMOTE_CONFIG_DEFAULTS,
  resolveRemoteConfig,
  type RemoteConfigKey,
  type RemoteConfigValues,
} from "@/config/remote-config";
import { getFirebaseApp } from "@/lib/firebase/client";

export type ClientSnapshot = {
  values: RemoteConfigValues;
  source: "default" | "remote" | "server";
};

const RemoteConfigContext = createContext<ClientSnapshot>({ values: REMOTE_CONFIG_DEFAULTS, source: "default" });

/** One SDK fetch per page load, shared by every provider mount (React Strict Mode mounts twice in dev). */
let clientFetch: Promise<Record<string, string> | null> | null = null;

function fetchClientEntries() {
  clientFetch ??= (async () => {
    if (!isFirebaseConfigured) return null;
    const { getRemoteConfig, fetchAndActivate, getAll, isSupported } = await import("firebase/remote-config");
    if (!(await isSupported())) return null;
    const rc = getRemoteConfig(getFirebaseApp());
    rc.settings.minimumFetchIntervalMillis = REMOTE_CONFIG_SETTINGS.clientMinFetchIntervalMs;
    rc.settings.fetchTimeoutMillis = REMOTE_CONFIG_SETTINGS.clientFetchTimeoutMs;
    await fetchAndActivate(rc);
    return Object.fromEntries(Object.entries(getAll(rc)).map(([k, v]) => [k, v.asString()]));
  })().catch((e) => {
    console.warn("[remote-config] client fetch failed, keeping server values:", e);
    return null;
  });
  return clientFetch;
}

/**
 * Renders with the server's values (so the first paint matches the HTML), then fetches
 * in the browser, where per-user conditions (A/B tests, rollouts, audiences) apply.
 */
export function RemoteConfigProvider({
  initial,
  children,
}: {
  initial: RemoteConfigValues;
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<ClientSnapshot>({ values: initial, source: "server" });

  useEffect(() => {
    let active = true;
    fetchClientEntries().then((entries) => {
      if (!active || !entries || Object.keys(entries).length === 0) return;
      setSnapshot({ values: resolveRemoteConfig(entries), source: "remote" });
    });
    return () => {
      active = false;
    };
  }, []);

  return <RemoteConfigContext.Provider value={snapshot}>{children}</RemoteConfigContext.Provider>;
}

/** All Remote Config values, plus where they came from. */
export function useRemoteConfig() {
  return useContext(RemoteConfigContext);
}

export function useRemoteValue<K extends RemoteConfigKey>(key: K): RemoteConfigValues[K] {
  return useContext(RemoteConfigContext).values[key];
}
