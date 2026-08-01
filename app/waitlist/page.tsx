import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistForm } from "./WaitlistForm";

export const metadata: Metadata = {
  title: "Kepli — catch the drift early",
  description:
    "Kepli compares what you said you'd do against what you actually did, and tells you the honest gap before months are gone. Join the beta waitlist.",
};

/**
 * Public waitlist page. Lives outside the `(app)` route group so it renders without
 * the nav and goal banner — a signed-out visitor has no goal to repeat.
 *
 * Copy is drawn from §1 of REQUIREMENTS.md: name the drift, name the two root causes,
 * and promise the one thing that fixes them.
 */
export default function WaitlistPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-bold tracking-tight text-white">Kepli</p>

      <h1 className="mt-8 text-3xl font-semibold leading-tight text-white sm:text-4xl">
        Catch yourself drifting before months are gone.
      </h1>

      <p className="mt-4 text-base leading-relaxed text-neutral-400">
        Not a habit tracker. Not a to-do app. Kepli compares what you{" "}
        <span className="text-neutral-200">said</span> you&apos;d do against what you{" "}
        <span className="text-neutral-200">actually</span> did, and tells you the
        honest gap early — with real numbers, not encouragement.
      </p>

      <ul className="mt-8 space-y-3">
        {[
          "One pre-decided action every day. Never a blank box.",
          "A check-in that takes under 60 seconds.",
          "A verdict with pace maths: what you said, what you did, what it costs.",
        ].map((line) => (
          <li key={line} className="flex gap-3 text-sm text-neutral-300">
            <span className="text-neutral-600" aria-hidden="true">
              —
            </span>
            {line}
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <WaitlistForm />
      </div>

      <p className="mt-6 text-xs text-neutral-600">
        Public beta opens 28 August 2026. No spam, one email when it&apos;s ready.
      </p>

      <p className="mt-12 text-xs text-neutral-700">
        <Link href="/" className="hover:text-neutral-500">
          Already have access? Go to the app
        </Link>
      </p>
    </div>
  );
}
