import Link from "next/link";
import {
  getActiveGoal,
  getCheckins,
  getCommitments,
} from "@/lib/data";
import {
  computePace,
  hitCount,
  paceSentence,
  pointsFor,
  scoreWeek,
  weeksSince,
} from "@/lib/scoring";
import { formatShort, fromDateString, toDateString } from "@/lib/date";
import type { Checkin, Commitment } from "@/types";

/**
 * History — past check-ins grouped by week, with F5 scoring and pace.
 *
 * The pace verdict leads, because it is the thing the user came to find out and the
 * one number a tracker usually hides. Points sit underneath as context: they measure
 * showing up, not progress, and the two are kept visually distinct so a good points
 * week never reads as "on track" when the pace says otherwise.
 */
export default async function HistoryPage() {
  const goal = await getActiveGoal();

  if (!goal) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">No goal yet</h1>
        <p className="mt-2 text-sm text-neutral-400">
          History starts once you have a goal to measure against.
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

  const [commitments, checkins] = await Promise.all([
    getCommitments(goal.id),
    getCheckins(),
  ]);

  const pace = computePace(goal, commitments, checkins);
  const weeks = weeksSince(goal.created_at);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
          Pace
        </h1>

        <div
          className={`mt-3 rounded-xl border p-5 ${
            pace.verdict === "on_track"
              ? "border-emerald-800 bg-emerald-950/30"
              : pace.verdict === "behind"
                ? "border-amber-800 bg-amber-950/20"
                : "border-red-900 bg-red-950/20"
          }`}
        >
          <p
            className={`text-xs font-medium uppercase tracking-wider ${
              pace.verdict === "on_track"
                ? "text-emerald-400"
                : pace.verdict === "behind"
                  ? "text-amber-400"
                  : "text-red-400"
            }`}
          >
            {VERDICT_LABEL[pace.verdict]}
          </p>

          <p className="mt-2 text-base leading-snug text-neutral-100">
            {paceSentence(pace, commitments)}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <Stat label="Done" value={String(pace.completed)} />
            <Stat label="Needed" value={String(pace.required_total)} />
            <Stat label="Per week" value={`${pace.actual_per_week} / ${pace.required_per_week}`} />
            <Stat
              label="Days left"
              value={pace.days_remaining < 0 ? "overdue" : String(pace.days_remaining)}
            />
          </dl>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
          By week
        </h2>

        {checkins.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No check-ins yet. The first one starts the record.
          </p>
        ) : (
          <div className="mt-3 space-y-6">
            {weeks.map((weekStartDate) => (
              <WeekBlock
                key={weekStartDate}
                weekStartDate={weekStartDate}
                checkins={checkins}
                commitments={commitments}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const VERDICT_LABEL: Record<string, string> = {
  on_track: "On track",
  behind: "Behind",
  at_risk: "At risk",
  no_data: "No data",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-sm tabular-nums text-neutral-200">{value}</dd>
    </div>
  );
}

function WeekBlock({
  weekStartDate,
  checkins,
  commitments,
}: {
  weekStartDate: string;
  checkins: Checkin[];
  commitments: Commitment[];
}) {
  const score = scoreWeek(checkins, commitments, weekStartDate);

  const end = toDateString(
    new Date(fromDateString(weekStartDate).getTime() + 6 * 86_400_000),
  );
  const inWeek = checkins
    .filter((c) => c.date >= weekStartDate && c.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date));

  // A week with no check-ins at all is still worth rendering — the gap is the signal.
  const byId = new Map(commitments.map((c) => [c.id, c.title]));

  return (
    <div className="rounded-lg border border-neutral-800">
      <div className="flex items-baseline justify-between gap-4 border-b border-neutral-800 px-4 py-3">
        <p className="text-sm font-medium text-neutral-200">
          Week of {formatShort(weekStartDate)}
        </p>
        <p className="shrink-0 text-xs tabular-nums text-neutral-500">
          {score.hits}/{score.target} hit · {score.points} pts
        </p>
      </div>

      {inWeek.length === 0 ? (
        <p className="px-4 py-3 text-sm text-neutral-600">
          Nothing logged this week.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {inWeek.map((checkin) => {
            const hits = Object.entries(checkin.commitments_hit)
              .filter(([, wasHit]) => wasHit)
              .map(([id]) => byId.get(id))
              .filter(Boolean);

            return (
              <li key={checkin.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-xs tabular-nums text-neutral-500">
                    {formatShort(checkin.date)}
                  </span>
                  <span
                    className={`shrink-0 text-xs tabular-nums ${
                      hitCount(checkin) > 0 ? "text-emerald-400" : "text-neutral-600"
                    }`}
                  >
                    {pointsFor(checkin)} pts
                  </span>
                </div>

                {checkin.note && (
                  <p className="mt-1 text-sm text-neutral-300">{checkin.note}</p>
                )}

                {hits.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-500">
                    {hits.join(" · ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
