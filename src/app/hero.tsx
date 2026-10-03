"use client";

import Link from "next/link";
import { useRemoteValue } from "@/lib/remote-config/client";

/** Landing headline and primary CTA, both editable (and A/B-testable) in Remote Config. */
export function Hero() {
  const title = useRemoteValue("hero_title");
  const ctaText = useRemoteValue("hero_cta_text");
  // "*text*" marks the highlighted part of the headline.
  const parts = title.split(/\*([^*]+)\*/);

  return (
    <>
      <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <span key={i} className="text-primary-600 dark:text-primary-400">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-ink-muted">
        Log training and meals, watch your progress, and talk it through with an AI coach that knows your numbers.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/login"
          data-cta="home_get_started"
          className="rounded-lg bg-primary-600 px-5 py-3 font-semibold text-white transition hover:bg-primary-700"
        >
          {ctaText}
        </Link>
        <Link
          href="/dashboard"
          data-cta="home_go_to_dashboard"
          className="rounded-lg border border-line bg-surface px-5 py-3 font-semibold transition hover:border-primary-300"
        >
          Go to dashboard
        </Link>
      </div>
    </>
  );
}
