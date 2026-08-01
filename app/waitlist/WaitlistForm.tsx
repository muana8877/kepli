"use client";

import { useState } from "react";
import { isValidEmail } from "@/lib/data";

/**
 * Waitlist signup. No backend in Phase 1 — the form validates and acknowledges, and
 * `joinWaitlist` in `lib/data` becomes a Supabase insert in Phase 2.
 *
 * The success state stays honest: it does not claim the address was stored.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setError("That does not look like an email address.");
      return;
    }

    // Phase 2: await joinWaitlist(email)
    setError(null);
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-6 text-center">
        <p className="text-sm font-medium text-emerald-400">You&apos;re on the list.</p>
        <p className="mt-2 text-sm text-neutral-400">
          We&apos;ll email {email} when the beta opens.
        </p>
        <p className="mt-4 text-xs text-neutral-600">
          Not stored yet — no backend in Phase 1.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
            placeholder="you@example.com"
            aria-invalid={error !== null}
            aria-describedby={error ? "email-error" : undefined}
            className={`w-full rounded-lg border bg-neutral-950 p-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none ${
              error
                ? "border-red-800 focus:border-red-700"
                : "border-neutral-800 focus:border-neutral-600"
            }`}
          />
        </div>

        <button
          type="submit"
          className="shrink-0 rounded-lg bg-white px-5 py-3 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Join the waitlist
        </button>
      </div>

      {error && (
        <p id="email-error" role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
