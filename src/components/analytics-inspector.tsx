"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CODE_EVENTS, CTAS } from "@/lib/analytics/events";
import { REMOTE_CONFIG, REMOTE_CONFIG_DEFAULTS, type RemoteConfigKey } from "@/config/remote-config";
import { useRemoteConfig } from "@/lib/remote-config/client";
import { eventLog, type LoggedEvent } from "@/lib/firebase/analytics";

const FLAG = "fittrack:analytics-debug";
const FLAG_EVENT = "fittrack:analytics-debug-change";

/** On in development; elsewhere opt in with ?analytics_debug=1 (and off with =0). Remembered per browser. */
function readEnabled() {
  if (process.env.NODE_ENV === "development") return true;
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

function subscribeEnabled(fn: () => void) {
  window.addEventListener(FLAG_EVENT, fn);
  return () => window.removeEventListener(FLAG_EVENT, fn);
}

const emptyLog: LoggedEvent[] = [];

export function AnalyticsInspector() {
  const enabled = useSyncExternalStore(subscribeEnabled, readEnabled, () => false);
  const events = useSyncExternalStore(eventLog.subscribe, eventLog.get, () => emptyLog);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"live" | "catalog" | "config">("live");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("analytics_debug");
    if (value === null) return;
    try {
      if (value === "1") localStorage.setItem(FLAG, "1");
      else localStorage.removeItem(FLAG);
    } catch {
      // Storage blocked (private mode): the panel just stays off.
    }
    window.dispatchEvent(new Event(FLAG_EVENT));
  }, []);

  if (!enabled) return null;

  return (
    // Clicks inside the inspector aren't tracked.
    <div data-analytics-ignore className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-4">
      {open && (
        <div className="flex max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface text-sm shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div className="flex gap-1">
              {(["live", "catalog", "config"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-md px-2.5 py-1 font-medium ${tab === t ? "bg-surface-muted text-ink" : "text-ink-muted hover:text-ink"}`}
                >
                  {t === "live" ? `Live (${events.length})` : t === "catalog" ? "Catalog" : "Config"}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {tab === "live" && events.length > 0 && (
                <button type="button" onClick={eventLog.clear} className="rounded-md px-2 py-1 text-ink-muted hover:text-ink">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close event inspector" className="rounded-md px-2 py-1 text-ink-muted hover:text-ink">
                ✕
              </button>
            </div>
          </div>

          <div className="overflow-y-auto">
            {tab === "live" ? <LiveLog events={events} /> : tab === "catalog" ? <Catalog /> : <RemoteConfigView />}
          </div>

          <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">
            Also in Firebase console → Analytics → DebugView (development) or Realtime (production).
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-xs font-medium text-ink shadow-md hover:border-primary-400"
      >
        GA events · {events.length}
      </button>
    </div>
  );
}

function LiveLog({ events }: { events: LoggedEvent[] }) {
  if (events.length === 0) {
    return <p className="px-3 py-6 text-center text-ink-muted">Click around — events show up here as they fire.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {events.map((e) => (
        <li key={e.id} className="px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono font-semibold text-primary-700 dark:text-primary-400">{e.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-ink-muted">
              {new Date(e.at).toLocaleTimeString()}
              {!e.sent && <span title="Firebase isn't configured or supported here, so this wasn't sent to GA."> · local only</span>}
            </span>
          </div>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 font-mono text-xs">
            {Object.entries(e.params).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="truncate">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Catalog() {
  return (
    <div className="px-3 py-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Click events (data-cta)</h3>
      <ul className="mt-1 divide-y divide-line">
        {Object.entries(CTAS).map(([id, c]) => (
          <li key={id} className="py-1.5">
            <div className="flex justify-between gap-2 font-mono text-xs">
              <span>{id}</span>
              <span className="text-primary-700 dark:text-primary-400">{c.event}</span>
            </div>
            <p className="text-xs text-ink-muted">{c.description}</p>
          </li>
        ))}
        <li className="py-1.5">
          <div className="flex justify-between gap-2 font-mono text-xs">
            <span>(any other button/link)</span>
            <span className="text-primary-700 dark:text-primary-400">cta_click</span>
          </div>
        </li>
      </ul>
      <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Code events</h3>
      <ul className="mt-1 divide-y divide-line">
        {Object.entries(CODE_EVENTS).map(([name, description]) => (
          <li key={name} className="py-1.5">
            <span className="font-mono text-xs text-primary-700 dark:text-primary-400">{name}</span>
            <p className="text-xs text-ink-muted">{description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const sourceLabel = {
  default: "code defaults (Firebase not configured)",
  server: "server fetch (refreshing in the browser…)",
  remote: "Remote Config, fetched in this browser",
} as const;

function RemoteConfigView() {
  const { values, source } = useRemoteConfig();
  return (
    <div className="px-3 py-2">
      <p className="text-xs text-ink-muted">Source: {sourceLabel[source]}</p>
      <ul className="mt-1 divide-y divide-line">
        {(Object.keys(REMOTE_CONFIG) as RemoteConfigKey[]).map((key) => {
          const value = JSON.stringify(values[key]);
          const isDefault = value === JSON.stringify(REMOTE_CONFIG_DEFAULTS[key]);
          return (
            <li key={key} className="py-1.5">
              <div className="flex justify-between gap-2 font-mono text-xs">
                <span>{key}</span>
                <span className="text-ink-muted">{isDefault ? "default" : "overridden"}</span>
              </div>
              <p className="mt-0.5 break-all font-mono text-xs text-primary-700 dark:text-primary-400">{value}</p>
              <p className="text-xs text-ink-muted">{REMOTE_CONFIG[key].description}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
