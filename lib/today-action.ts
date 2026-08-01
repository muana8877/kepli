import type { Checkin, Commitment, TodayAction } from "@/types";
import { toDateString, weekStart } from "@/lib/date";

/**
 * F2 — derive today's ONE pre-decided action.
 *
 * Design law from §1: remove the decision. This function must return an action
 * whenever any commitment exists, so the Today screen is never a blank box. When
 * every weekly target is already met it hands back a bonus rep rather than nothing.
 *
 * Selection rule: pick the commitment furthest behind its weekly target, measured as
 * the share of the target still outstanding. Ties break toward the larger absolute
 * shortfall, then toward the order the user listed them — a stable order matters,
 * because an action that changes on every refresh is a decision again.
 */

/** Count hits per commitment id within the current Monday–Sunday week. */
export function hitsThisWeek(
  checkins: Checkin[],
  reference: Date = new Date(),
): Record<string, number> {
  const start = toDateString(weekStart(reference));
  const end = toDateString(reference);

  const counts: Record<string, number> = {};
  for (const checkin of checkins) {
    if (checkin.date < start || checkin.date > end) continue;
    for (const [commitmentId, wasHit] of Object.entries(checkin.commitments_hit)) {
      if (wasHit) counts[commitmentId] = (counts[commitmentId] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * The single action for today, or null only when there are no commitments at all —
 * in which case the caller should be prompting the user to create a goal, not
 * showing an empty Today screen.
 */
export function deriveTodayAction(
  commitments: Commitment[],
  checkins: Checkin[],
  reference: Date = new Date(),
): TodayAction | null {
  if (commitments.length === 0) return null;

  const counts = hitsThisWeek(checkins, reference);

  const ranked = commitments
    .map((commitment, index) => {
      const done = counts[commitment.id] ?? 0;
      const remaining = Math.max(0, commitment.target_per_week - done);
      // Guard against a zero target so the ratio stays finite.
      const shortfallRatio =
        commitment.target_per_week > 0 ? remaining / commitment.target_per_week : 0;
      return { commitment, done, remaining, shortfallRatio, index };
    })
    .sort(
      (a, b) =>
        b.shortfallRatio - a.shortfallRatio ||
        b.remaining - a.remaining ||
        a.index - b.index,
    );

  const top = ranked[0];
  const isBonus = top.remaining === 0;

  return {
    commitment_id: top.commitment.id,
    action: phraseAction(top.commitment.title, isBonus),
    done_this_week: top.done,
    target_per_week: top.commitment.target_per_week,
    is_bonus: isBonus,
  };
}

/**
 * Turn a commitment title into an imperative instruction. Commitments are stored as
 * nouns ("Build session"), and the Today screen needs a sentence the user can act on
 * without interpreting it.
 */
function phraseAction(title: string, isBonus: boolean): string {
  const normalised = title.trim();
  if (isBonus) return `Week's target is met. Bonus: ${lowerFirst(normalised)}.`;
  return `Do one: ${lowerFirst(normalised)}.`;
}

function lowerFirst(value: string): string {
  if (value.length === 0) return value;
  // Leave acronyms alone — "PR review" should not become "pR review".
  if (value[0] === value[0].toUpperCase() && value[1] === value[1]?.toUpperCase()) {
    return value;
  }
  return value[0].toLowerCase() + value.slice(1);
}
