"use client";

import { track } from "@/lib/firebase/analytics";
import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={signOut} onSubmit={() => track("logout")}>
      <button
        type="submit"
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:border-ink-muted hover:text-ink"
      >
        Sign out
      </button>
    </form>
  );
}
