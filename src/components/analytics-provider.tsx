"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { identify, trackCta, trackPageView } from "@/lib/firebase/analytics";
import { AnalyticsInspector } from "./analytics-inspector";

const CLICKABLE = 'a[href], button, [role="button"], input[type="submit"]';

/** Accessible name of a clicked element, for the event's cta_text. */
function labelOf(el: HTMLElement) {
  return (
    el.getAttribute("aria-label") ||
    el.textContent?.replace(/\s+/g, " ").trim() ||
    el.getAttribute("title") ||
    (el as HTMLInputElement).value ||
    ""
  );
}

/**
 * Sends a page_view on every route change, keeps the analytics user id in sync,
 * and tracks every button/link click (see src/lib/analytics/events.ts).
 */
export function AnalyticsProvider({ userId }: { userId: string | null }) {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    identify(userId);
  }, [userId]);

  useEffect(() => {
    // Capture phase, so the click is logged before a link navigates away.
    function onClick(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(CLICKABLE);
      if (!el || el.closest("[data-analytics-ignore]")) return;
      if ((el as HTMLButtonElement).disabled) return;
      const id = el.closest<HTMLElement>("[data-cta]")?.dataset.cta ?? null;
      const href = el instanceof HTMLAnchorElement ? (el.getAttribute("href") ?? undefined) : undefined;
      trackCta(id, labelOf(el), href);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return <AnalyticsInspector />;
}
