"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign-in: Google OAuth, or an emailed magic link.
 *
 * Magic link rather than password on purpose — no password to store, reset or leak,
 * and one fewer field between the user and the app. Kepli's whole premise is removing
 * friction from a daily habit; a login wall is the first place that gets tested.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  // Where the proxy wanted them to land before it bounced them here.
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function signInWithGoogle() {
    setPending("google");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
      setPending(null);
    }
    // On success the browser is navigating to Google — leave the pending state up.
  }

  async function signInWithEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending("email");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setPending(null);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-6 text-center">
        <p className="text-sm font-medium text-emerald-400">Check your email.</p>
        <p className="mt-2 text-sm text-neutral-400">
          We sent a sign-in link to {email}. It expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={pending !== null}
        className="w-full rounded-lg border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-100 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending === "google" ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-neutral-800" />
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          or
        </span>
        <span className="h-px flex-1 bg-neutral-800" />
      </div>

      <form onSubmit={signInWithEmail} noValidate className="space-y-3">
        <label htmlFor="email" className="sr-only">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          disabled={pending !== null}
          placeholder="you@example.com"
          aria-invalid={error !== null}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={pending !== null}
          className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {pending === "email" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
