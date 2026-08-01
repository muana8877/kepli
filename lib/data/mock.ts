import type {
  Checkin,
  Commitment,
  Goal,
  Milestone,
  User,
} from "@/types";
import { addDays, toDateString, weekStart } from "@/lib/date";

/**
 * The seed dataset for Phase 1. Deliberately mid-drift rather than clean: the goal is
 * three weeks old with commitments partly missed, because a Today screen and a
 * check-in list only prove they work against a history that has gaps in it.
 *
 * Dates are generated relative to "now" so the fixtures never go stale.
 */

export const MOCK_USER: User = {
  id: "user-1",
  email: "builder@kepli.app",
};

const today = new Date();
const goalStart = addDays(today, -21);

export const MOCK_GOAL: Goal = {
  id: "goal-1",
  user_id: MOCK_USER.id,
  title: "Ship Kepli to public beta",
  why: "Because I have missed every self-set deadline this year and I want one finished thing to point at.",
  deadline: toDateString(addDays(today, 28)),
  created_at: goalStart.toISOString(),
};

export const MOCK_MILESTONES: Milestone[] = [
  {
    id: "milestone-1",
    goal_id: MOCK_GOAL.id,
    title: "Waitlist page live and collecting emails",
    target_date: toDateString(addDays(today, -7)),
    status: "hit",
  },
  {
    id: "milestone-2",
    goal_id: MOCK_GOAL.id,
    title: "Daily loop working end to end",
    target_date: toDateString(addDays(today, 7)),
    status: "pending",
  },
  {
    id: "milestone-3",
    goal_id: MOCK_GOAL.id,
    title: "Drift detection returning real verdicts",
    target_date: toDateString(addDays(today, 21)),
    status: "pending",
  },
];

export const MOCK_COMMITMENTS: Commitment[] = [
  {
    id: "commitment-1",
    goal_id: MOCK_GOAL.id,
    title: "Build session",
    cadence: "weekly",
    target_per_week: 5,
  },
  {
    id: "commitment-2",
    goal_id: MOCK_GOAL.id,
    title: "Post in public",
    cadence: "weekly",
    target_per_week: 3,
  },
  {
    id: "commitment-3",
    goal_id: MOCK_GOAL.id,
    title: "Talk to a potential user",
    cadence: "weekly",
    target_per_week: 1,
  },
];

/**
 * Check-ins for the current week and the two before it. The current week is
 * intentionally left incomplete so the Today screen has an action to hand out.
 */
function seedCheckins(): Checkin[] {
  const thisWeek = weekStart(today);

  // [daysAfterWeekStart, note, commitment ids hit]
  const seed: Array<[number, string, string[]]> = [
    // Two weeks ago — a strong week, then the slide begins.
    [-14, "Wired up the schema. Felt good.", ["commitment-1"]],
    [-13, "Two hours before work. Auth done.", ["commitment-1", "commitment-2"]],
    [-12, "Nothing. Day job ate it.", []],
    [-11, "Short session, fixed the layout.", ["commitment-1"]],
    [-10, "Posted the first progress note.", ["commitment-2"]],
    [-9, "Call with someone who has the same problem.", ["commitment-3"]],
    // Last week — the drift.
    [-7, "Tired. Read docs, wrote nothing.", []],
    [-6, "One commit. Barely the floor.", ["commitment-1"]],
    [-5, "Nothing again.", []],
    [-4, "Got the check-in form rendering.", ["commitment-1"]],
    [-3, "Meant to post. Did not.", []],
    // This week so far.
    [0, "Back at it. Types and data layer.", ["commitment-1"]],
    [1, "Second session. Today screen shaping up.", ["commitment-1"]],
  ];

  return seed.map(([offset, note, hit], i) => {
    const date = toDateString(addDays(thisWeek, offset));
    const commitments_hit = Object.fromEntries(hit.map((id) => [id, true]));
    // 10 points per commitment hit, +5 for showing up at all. Placeholder scoring —
    // F5 defines the real rules and is out of scope for Phase 1.
    const points = hit.length * 10 + (hit.length > 0 ? 5 : 0);

    return {
      id: `checkin-${i + 1}`,
      user_id: MOCK_USER.id,
      date,
      note,
      commitments_hit,
      points,
      score: points,
    };
  });
}

export const MOCK_CHECKINS: Checkin[] = seedCheckins();
