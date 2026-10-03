"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { track } from "@/lib/firebase/analytics";
import { login, signInWithGoogle, signup, type AuthState } from "./actions";

const initial: AuthState = { status: "idle" };

export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
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
            data-cta={m === "login" ? "auth_tab_login" : "auth_tab_signup"}
            className={`rounded-md py-2 transition ${
              mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <form
        action={mode === "login" ? loginAction : signupAction}
        data-cta={mode === "login" ? "auth_submit_login" : "auth_submit_signup"}
        className="space-y-4"
      >
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
          <div className="relative mt-1">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "signup" ? 8 : undefined}
              required
              className="w-full rounded-lg border border-line bg-surface py-2.5 pl-3 pr-10 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              data-cta="auth_toggle_password"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-muted hover:text-ink"
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
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

      <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <form action={signInWithGoogle} data-cta="auth_google">
        <input type="hidden" name="next" value={next} />
        <GoogleButton disabled={pending} />
      </form>
    </div>
  );
}

function GoogleButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface py-2.5 font-medium transition hover:bg-surface-muted disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
      {pending ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {off ? (
        <>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </>
      ) : (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}
