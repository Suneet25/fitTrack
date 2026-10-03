"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { identify, trackPageView } from "@/lib/firebase/analytics";

/** Sends a page_view on every route change and keeps the analytics user id in sync. */
export function AnalyticsProvider({ userId }: { userId: string | null }) {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    identify(userId);
  }, [userId]);

  return null;
}
