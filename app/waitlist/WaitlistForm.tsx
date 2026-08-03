"use client";

import { useState } from "react";
// Imported from the leaf module, not `@/lib/data`: that index imports the server
// Supabase client, which cannot be bundled for the browser.
import { joinWaitlist } from "@/lib/data/waitlist";

/**
 * Waitlist signup. Writes to Supabase through the `lib/data` seam — this component
 * never touches a Supabase client itself.
 *
 * Validation lives in `joinWaitlist` rather than here so the rule holds for every
 * caller, not just this form.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    const result = await joinWaitlist(email);

    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Try again.");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-6 text-center">
        <p className="text-sm font-medium text-emerald-400">You&apos;re on the list.</p>
        <p className="mt-2 text-sm text-neutral-400">
          We&apos;ll email {email} when the beta opens.
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
            disabled={pending}
            placeholder="you@example.com"
            aria-invalid={error !== null}
            aria-describedby={error ? "email-error" : undefined}
            className={`w-full rounded-lg border bg-neutral-950 p-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none disabled:opacity-60 ${
              error
                ? "border-red-800 focus:border-red-700"
                : "border-neutral-800 focus:border-neutral-600"
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-white px-5 py-3 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {pending ? "Joining…" : "Join the waitlist"}
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
