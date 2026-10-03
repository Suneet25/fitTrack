"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/firebase/analytics";
import { login, signup, type AuthState } from "./actions";

const initial: AuthState = { status: "idle" };

export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState(login, initial);
  const [signupState, signupAction, signupPending] = useActionState(signup, initial);
  const router = useRouter();

  const state = mode === "login" ? loginState : signupState;
  const pending = loginPending || signupPending;

  useEffect(() => {
    if (state.status !== "success") return;
    track(state.event, { method: "email" });
    router.replace(state.next);
    router.refresh();
  }, [state, router]);

  if (state.status === "check_email") {
    return (
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-5 text-primary-900">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-sm">
          We sent a confirmation link to <strong>{state.email}</strong>. Open it to finish signing up.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-surface-muted p-1 text-sm font-medium">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md py-2 transition ${
              mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <form action={mode === "login" ? loginAction : signupAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "signup" ? 8 : undefined}
            required
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          />
        </label>

        {state.status === "error" && (
          <p role="alert" className="rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-800">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-primary-600 py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
        >
          {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
