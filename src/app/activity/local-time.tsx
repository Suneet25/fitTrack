"use client";

/** Formats a timestamp in the viewer's own time zone (the server doesn't know it). */
export function LocalTime({ iso, options }: { iso: string; options: Intl.DateTimeFormatOptions }) {
  return <time dateTime={iso} suppressHydrationWarning>{new Date(iso).toLocaleString("en-US", options)}</time>;
}
