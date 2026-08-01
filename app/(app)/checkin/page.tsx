import Link from "next/link";
import { CheckinForm } from "./CheckinForm";
import { getActiveGoal, getCheckins, getCommitments, getTodayCheckin } from "@/lib/data";
import { formatShort } from "@/lib/date";

/**
 * F3 — daily check-in. The server component fetches; the form owns the interaction.
 * Recent check-ins are listed below as a short history, which is what makes a gap
 * visible without any AI involved yet.
 */
export default async function CheckinPage() {
  const goal = await getActiveGoal();

  if (!goal) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">No goal yet</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Set a goal before checking in — there is nothing to check in against.
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

  const [commitments, existing, checkins] = await Promise.all([
    getCommitments(goal.id),
    getTodayCheckin(),
    getCheckins(),
  ]);

  const recent = checkins.slice(0, 7);

  return (
    <div className="space-y-10">
      <CheckinForm commitments={commitments} existing={existing} />

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
          Recent
        </h2>

        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No check-ins yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-800 rounded-lg border border-neutral-800">
            {recent.map((checkin) => {
              const hitCount = Object.values(checkin.commitments_hit).filter(
                Boolean,
              ).length;

              return (
                <li key={checkin.id} className="flex gap-4 px-4 py-3">
                  <span className="w-20 shrink-0 text-xs tabular-nums text-neutral-500">
                    {formatShort(checkin.date)}
                  </span>
                  <span className="flex-1 text-sm text-neutral-300">
                    {checkin.note || (
                      <span className="text-neutral-600">No note</span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-xs tabular-nums ${
                      hitCount > 0 ? "text-emerald-400" : "text-neutral-600"
                    }`}
                  >
                    {hitCount > 0 ? `${hitCount} hit` : "missed"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
