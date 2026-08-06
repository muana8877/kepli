import type {
  Checkin,
  Commitment,
  DateString,
  Goal,
  PaceMath,
} from "@/types";
import { daysBetween, fromDateString, toDateString, weekStart } from "@/lib/date";

/**
 * F5 — scoring and pace.
 *
 * Two signals that are deliberately kept apart:
 *
 *   Points  reward showing up. They are generous on purpose: §10's working rule is
 *           "hitting the floor is not failure", and a scheme that scores a hard day
 *           the same as vanishing removes the reason to check in while slipping.
 *
 *   Pace    tells the truth. Pure arithmetic against the deadline, with no softening.
 *           This is what produces "at this rate you miss by October".
 *
 * They can disagree, and should: "you showed up six days (85 pts), and you are still
 * three weeks behind" is two true statements. Collapsing them into one number makes a
 * tracker either dishonest or demoralising.
 *
 * Everything here is a pure function with no database access, so the Week 3 eval
 * harness can assert against it deterministically.
 */

/** Points for hitting one commitment. */
const POINTS_PER_HIT = 10;

/** Points for checking in at all, even with nothing hit. */
const POINTS_FOR_SHOWING_UP = 5;

/** Count of commitments marked hit on a check-in. */
export function hitCount(checkin: Checkin): number {
  return Object.values(checkin.commitments_hit).filter(Boolean).length;
}

/**
 * Points for a single check-in.
 *
 * The existence of the check-in row is itself the "showed up" signal — a day with no
 * row scores nothing, because nothing was recorded.
 *
 * Uncapped by design: a single day cannot exceed the number of commitments that
 * exist. The weekly cap lives in `scoreWeek`, where over-delivering across days
 * genuinely could push a total past its own maximum.
 */
export function pointsFor(checkin: Checkin): number {
  return hitCount(checkin) * POINTS_PER_HIT + POINTS_FOR_SHOWING_UP;
}

/** The most a day can score when every commitment is hit. */
export function maxDailyPoints(commitments: Commitment[]): number {
  return commitments.length * POINTS_PER_HIT + POINTS_FOR_SHOWING_UP;
}

export interface WeeklyScore {
  week_start: DateString;
  /** Points earned across the week. */
  points: number;
  /** Points available if every commitment were hit every day it was targeted. */
  points_available: number;
  /** Days in the week with a check-in recorded. */
  days_checked_in: number;
  /** Total commitments hit across the week. */
  hits: number;
  /** Commitments the plan targets per week. */
  target: number;
}

/**
 * Score one week, Monday–Sunday.
 *
 * `points_available` is based on the week's committed targets rather than
 * `commitments.length × 7`: a 3×/week commitment cannot be hit seven times, so
 * measuring against seven would make every week look like a failure.
 */
export function scoreWeek(
  checkins: Checkin[],
  commitments: Commitment[],
  weekStartDate: DateString,
): WeeklyScore {
  const start = weekStartDate;
  const end = toDateString(
    new Date(fromDateString(weekStartDate).getTime() + 6 * 86_400_000),
  );

  const inWeek = checkins.filter((c) => c.date >= start && c.date <= end);

  const rawHits = inWeek.reduce((sum, c) => sum + hitCount(c), 0);
  const target = commitments.reduce((sum, c) => sum + c.target_per_week, 0);

  // Hits beyond the week's target still count as showing up, but they do not earn
  // points — otherwise a week can score above its own maximum, and "113% of target"
  // is not a number anyone can act on. Over-delivering on one commitment also cannot
  // paper over neglecting another.
  const hits = Math.min(rawHits, target);

  const showUpDays = inWeek.length;
  const points = hits * POINTS_PER_HIT + showUpDays * POINTS_FOR_SHOWING_UP;

  // A full week: every targeted commitment hit, plus a show-up bonus for all seven
  // days, since checking in daily is itself the habit being protected.
  const points_available = target * POINTS_PER_HIT + 7 * POINTS_FOR_SHOWING_UP;

  return {
    week_start: start,
    points,
    points_available,
    days_checked_in: inWeek.length,
    hits,
    target,
  };
}

/** Every week from the goal's creation to today, newest first. */
export function weeksSince(goalCreatedAt: string, upTo: Date = new Date()): DateString[] {
  const first = weekStart(new Date(goalCreatedAt));
  const current = weekStart(upTo);

  const weeks: DateString[] = [];
  for (
    let d = new Date(current);
    d.getTime() >= first.getTime();
    d.setDate(d.getDate() - 7)
  ) {
    weeks.push(toDateString(d));
  }
  return weeks;
}

export type PaceVerdict = "on_track" | "behind" | "at_risk" | "no_data";

export interface Pace extends PaceMath {
  verdict: PaceVerdict;
  /** Days by which the current rate misses the deadline. Negative means early. */
  days_off_target: number;
}

/**
 * Pace against the deadline — the honest signal.
 *
 * Rate is measured over days elapsed ÷ 7 rather than counting calendar weeks. A goal
 * created on a Thursday would otherwise show a wildly distorted rate for its first
 * partial week, which is exactly when a user is most likely to look.
 */
export function computePace(
  goal: Goal,
  commitments: Commitment[],
  checkins: Checkin[],
  reference: Date = new Date(),
): Pace {
  const startDate = toDateString(new Date(goal.created_at));
  const todayDate = toDateString(reference);

  // At least 1 so the first day does not divide by zero.
  const days_elapsed = Math.max(1, daysBetween(startDate, todayDate));
  const days_remaining = daysBetween(todayDate, goal.deadline);

  const required_per_week = commitments.reduce(
    (sum, c) => sum + c.target_per_week,
    0,
  );

  // Only count check-ins from the goal's start; earlier rows belong to a previous goal.
  const completed = checkins
    .filter((c) => c.date >= startDate && c.date <= todayDate)
    .reduce((sum, c) => sum + hitCount(c), 0);

  const weeks_elapsed = days_elapsed / 7;
  const actual_per_week = weeks_elapsed > 0 ? completed / weeks_elapsed : 0;

  const total_days = Math.max(1, daysBetween(startDate, goal.deadline));
  const required_total = Math.round(required_per_week * (total_days / 7));

  const remaining_work = Math.max(0, required_total - completed);

  // Days the current rate needs to finish what is left. Null when nothing is moving.
  const daily_rate = actual_per_week / 7;
  const days_needed = daily_rate > 0 ? remaining_work / daily_rate : null;

  const projected_completion_date =
    days_needed === null
      ? null
      : toDateString(
          new Date(reference.getTime() + Math.ceil(days_needed) * 86_400_000),
        );

  const days_off_target =
    days_needed === null ? Infinity : Math.round(days_needed - days_remaining);

  return {
    required_per_week,
    actual_per_week: Number(actual_per_week.toFixed(2)),
    days_elapsed,
    days_remaining,
    completed,
    required_total,
    projected_completion_date,
    verdict: verdictFor(completed, days_off_target, days_remaining),
    days_off_target: days_off_target === Infinity ? Infinity : days_off_target,
  };
}

/**
 * Thresholds are deliberately blunt. "Behind" starts the moment the projection slips
 * past the deadline — §F4 requires specific and numeric, never vague encouragement,
 * so there is no grace band that quietly reports a miss as fine.
 */
function verdictFor(
  completed: number,
  daysOffTarget: number,
  daysRemaining: number,
): PaceVerdict {
  if (completed === 0) return daysRemaining > 0 ? "at_risk" : "no_data";
  if (daysOffTarget === Infinity) return "at_risk";
  if (daysOffTarget <= 0) return "on_track";
  // More than a fortnight past the deadline at the current rate.
  if (daysOffTarget > 14) return "at_risk";
  return "behind";
}

/**
 * One honest sentence with the numbers in it, for the history header.
 *
 * §F4 owns AI-written verdicts; this is the deterministic version that pace math can
 * produce on its own, and it is what the eval harness will assert against.
 */
export function paceSentence(pace: Pace, commitments: Commitment[]): string {
  const targets = commitments
    .map((c) => `${c.target_per_week}× ${c.title.toLowerCase()}`)
    .join(", ");

  if (pace.completed === 0) {
    return `You committed to ${targets} a week. You have logged nothing in ${pace.days_elapsed} days.`;
  }

  const rate = `You said ${pace.required_per_week} a week. You are averaging ${pace.actual_per_week} over ${pace.days_elapsed} days.`;

  if (pace.verdict === "on_track") {
    return `${rate} That clears the deadline with ${Math.abs(pace.days_off_target)} days to spare.`;
  }

  if (pace.days_off_target === Infinity) {
    return `${rate} At this rate you do not finish.`;
  }

  return `${rate} At this rate you miss by ${pace.days_off_target} days.`;
}
