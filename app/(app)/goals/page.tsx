import Link from "next/link";
import { getActiveGoal, getCheckins, getCommitments, getMilestones } from "@/lib/data";
import { hitsThisWeek } from "@/lib/today-action";
import { daysUntil, formatLong } from "@/lib/date";
import type { MilestoneStatus } from "@/types";

/**
 * The full plan: milestones and weekly commitments. The banner carries the goal
 * itself on every screen, so this page shows what the banner cannot — the structure
 * underneath it, and how this week is tracking against it.
 */
export default async function GoalPage() {
  const goal = await getActiveGoal();

  if (!goal) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">No goal yet</h1>
        <p className="mt-2 text-sm text-neutral-400">
          One long-term goal, broken into milestones and weekly commitments.
        </p>
        <Link
          href="/goals/new"
          className="mt-6 inline-block rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Set your goal
        </Link>
      </div>
    );
  }

  const [milestones, commitments, checkins] = await Promise.all([
    getMilestones(goal.id),
    getCommitments(goal.id),
    getCheckins(),
  ]);

  const counts = hitsThisWeek(checkins);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
          Milestones
        </h1>

        {milestones.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No milestones set.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-800 rounded-lg border border-neutral-800">
            {milestones.map((milestone) => {
              const remaining = daysUntil(milestone.target_date);

              return (
                <li
                  key={milestone.id}
                  className="flex items-start justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-100">{milestone.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {formatLong(milestone.target_date)}
                      {milestone.status === "pending" &&
                        remaining >= 0 &&
                        ` — ${remaining} days`}
                    </p>
                  </div>
                  <StatusPill status={milestone.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
          Weekly commitments
        </h2>

        {commitments.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No commitments set.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-800 rounded-lg border border-neutral-800">
            {commitments.map((commitment) => {
              const done = counts[commitment.id] ?? 0;
              const met = done >= commitment.target_per_week;

              return (
                <li
                  key={commitment.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="text-sm text-neutral-100">
                    {commitment.title}
                  </span>
                  <span
                    className={`shrink-0 text-sm tabular-nums ${
                      met ? "text-emerald-400" : "text-neutral-500"
                    }`}
                  >
                    {done}/{commitment.target_per_week} this week
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Link
        href="/goals/new"
        className="inline-block rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800"
      >
        Set a new goal
      </Link>
    </div>
  );
}

function StatusPill({ status }: { status: MilestoneStatus }) {
  const styles: Record<MilestoneStatus, string> = {
    hit: "border-emerald-800 text-emerald-400",
    missed: "border-red-900 text-red-400",
    pending: "border-neutral-700 text-neutral-500",
  };

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${styles[status]}`}
    >
      {status}
    </span>
  );
}
