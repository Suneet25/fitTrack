"use client";

import Link from "next/link";
import { useRemoteValue } from "@/lib/remote-config/client";

const tones = {
  info: "bg-primary-600 text-white",
  success: "bg-primary-700 text-white",
  warning: "bg-secondary-500 text-white",
} as const;

/** Site-wide banner driven by the `announcement` Remote Config key. Hidden when its text is empty. */
export function AnnouncementBanner() {
  const { text, href, tone = "info" } = useRemoteValue("announcement");
  if (!text.trim()) return null;

  return (
    <div role="status" className={`px-4 py-2 text-center text-sm font-medium ${tones[tone]}`}>
      {href ? (
        <Link href={href} data-cta="announcement_banner" className="underline-offset-2 hover:underline">
          {text} →
        </Link>
      ) : (
        text
      )}
    </div>
  );
}
