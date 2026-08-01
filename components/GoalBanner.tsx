import Link from "next/link";
import type { Goal } from "@/types";
import { daysUntil, formatLong } from "@/lib/date";

/**
 * F6 — goal repetition. Rendered in the root layout so the goal and its "why" are on
 * every screen. The countdown is the point: "28 days left" is harder to ignore than a
 * date, and losing sight of the target is the failure mode this feature exists for.
 */
export function GoalBanner({ goal }: { goal: Goal | null }) {
  if (!goal) {
    return (
      <div className="border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm text-neutral-400">No goal set yet.</p>
          <Link
            href="/goals/new"
            className="shrink-0 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Set your goal
          </Link>
        </div>
      </div>
    );
  }

  const remaining = daysUntil(goal.deadline);

  return (
    <div className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Your goal
          </p>
          <p
            className={`shrink-0 text-xs font-medium tabular-nums ${
              remaining < 0
                ? "text-red-400"
                : remaining <= 7
                  ? "text-amber-400"
                  : "text-neutral-400"
            }`}
          >
            {remaining < 0
              ? `${Math.abs(remaining)} days overdue`
              : remaining === 0
                ? "Deadline is today"
                : `${remaining} days left`}
          </p>
        </div>

        <h2 className="mt-0.5 text-base font-semibold text-white">
          {goal.title}
        </h2>
        <p className="mt-1 text-sm leading-snug text-neutral-400">
          {goal.why}
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          Deadline {formatLong(goal.deadline)}
        </p>
      </div>
    </div>
  );
}
