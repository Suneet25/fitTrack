import Link from "next/link";
import { NavLinks } from "./nav-links";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader({ email }: { email?: string }) {
  return (
    <header className="border-b border-line bg-surface">
      {/* On phones the nav drops to its own row below the logo and sign-out button. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Fit<span className="text-primary-600 dark:text-primary-400">Track</span>
        </Link>
        <div className="order-last -ml-2.5 w-full sm:order-0 sm:ml-0 sm:mr-auto sm:w-auto">
          <NavLinks />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-muted md:inline">{email}</span>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
