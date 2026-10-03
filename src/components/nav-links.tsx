"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRemoteValue } from "@/lib/remote-config/client";

const allLinks = [
  { href: "/dashboard", label: "Home", cta: "nav_home" },
  { href: "/workouts", label: "Workouts", cta: "nav_workouts" },
  { href: "/workouts/learn", label: "Learn", cta: "nav_learn" },
  { href: "/activity", label: "Activity", cta: "nav_activity" },
];

export function NavLinks() {
  const pathname = usePathname();
  const healthEnabled = useRemoteValue("google_health_enabled");
  const links = allLinks.filter((l) => healthEnabled || l.href !== "/activity");
  // Longest matching prefix wins, so /workouts/learn doesn't also light up "Workouts".
  const active = links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex gap-1 text-sm font-medium">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          data-cta={l.cta}
          className={`rounded-md px-2.5 py-1.5 transition ${
            active === l.href ? "bg-primary-50 text-primary-700 dark:text-primary-400" : "text-ink-muted hover:text-ink"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
