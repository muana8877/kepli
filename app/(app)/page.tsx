import Link from "next/link";
import {
  getActiveGoal,
  getCheckins,
  getCommitments,
  getTodayAction,
  getTodayCheckin,
} from "@/lib/data";
import { hitsThisWeek } from "@/lib/today-action";
import { formatLong, today } from "@/lib/date";

/**
 * F2 — the Today screen.
 *
 * One pre-decided action, stated as an instruction, above everything else. The week's
 * progress sits below it as context, never above: the moment the user has to read a
 * table and work out what to do, the decision is back and the feature has failed.
 */
export default async function TodayPage() {
  const goal = await getActiveGoal();

  if (!goal) {
    return (
      <EmptyState
        title="No goal yet"
        body="Kepli needs one long-term goal to work from. Set it once, then it tells you what today's action is."
        cta={{ href: "/goals/new", label: "Set your goal" }}
      />
    );
  }

  const [action, commitments, checkins, todayCheckin] = await Promise.all([
    getTodayAction(),
    getCommitments(goal.id),
    getCheckins(),
    getTodayCheckin(),
  ]);

  if (!action || commitments.length === 0) {
    return (
      <EmptyState
        title="No weekly commitments"
        body="Your goal has no commitments attached, so there is nothing to derive today's action from."
        cta={{ href: "/goals/new", label: "Add commitments" }}
      />
    );
  }

  const counts = hitsThisWeek(checkins);
  const alreadyCheckedIn = todayCheckin !== null;
  const doneToday =
    todayCheckin?.commitments_hit[action.commitment_id] === true;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-neutral-500">{formatLong(today())}</p>
        <h1 className="mt-1 text-sm font-medium uppercase tracking-wider text-neutral-500">
          Today
        </h1>
      </div>

      {/* The one action. Everything about this block is sized to be unmissable. */}
      <section
        className={`rounded-xl border p-6 ${
          doneToday
            ? "border-emerald-800 bg-emerald-950/30"
            : "border-neutral-700 bg-neutral-900"
        }`}
      >
        {doneToday ? (
          <p className="text-sm font-medium text-emerald-400">
            Done today. Anything else is a bonus.
          </p>
        ) : action.is_bonus ? (
          <p className="text-sm font-medium text-neutral-400">
            You are ahead this week.
          </p>
        ) : (
          <p className="text-sm font-medium text-neutral-400">
            Your one action today
          </p>
        )}

        <p className="mt-3 text-2xl font-semibold leading-snug text-white">
          {action.action}
        </p>

        <p className="mt-3 text-sm tabular-nums text-neutral-500">
          {action.done_this_week} of {action.target_per_week} done this week
        </p>

        <Link
          href="/checkin"
          className="mt-6 inline-block rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          {alreadyCheckedIn ? "Update today's check-in" : "Check in"}
        </Link>
      </section>

      {/* Context, deliberately below the action. */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
          This week
        </h2>
        <ul className="mt-3 divide-y divide-neutral-800 rounded-lg border border-neutral-800">
          {commitments.map((commitment) => {
            const done = counts[commitment.id] ?? 0;
            const met = done >= commitment.target_per_week;

            return (
              <li
                key={commitment.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="text-sm text-neutral-200">
                  {commitment.title}
                </span>
                <span
                  className={`shrink-0 text-sm tabular-nums ${
                    met ? "text-emerald-400" : "text-neutral-500"
                  }`}
                >
                  {done}/{commitment.target_per_week}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-400">{body}</p>
      <Link
        href={cta.href}
        className="mt-6 inline-block rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
      >
        {cta.label}
      </Link>
    </div>
  );
}
