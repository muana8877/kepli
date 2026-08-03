import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Kepli",
};

/**
 * Sign-in page. Outside the `(app)` route group, so it renders without the nav and
 * goal banner — a signed-out visitor has no goal to repeat.
 *
 * The form is wrapped in Suspense because it reads `useSearchParams`, which opts the
 * subtree into client-side rendering; without a boundary the whole route would be
 * forced dynamic.
 */
export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-16">
      <p className="text-sm font-bold tracking-tight text-white">Kepli</p>

      <h1 className="mt-6 text-2xl font-semibold text-white">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Pick up where you left off.
      </p>

      <div className="mt-8">
        <Suspense
          fallback={<div className="h-52 animate-pulse rounded-lg bg-neutral-900" />}
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
