/**
 * Kepli data model — mirrors §6 of REQUIREMENTS.md.
 *
 * These types are the contract between the UI and `lib/data/`. They are written to
 * match the eventual Postgres/Supabase column names exactly (snake_case, ISO date
 * strings) so that swapping the mock layer for real queries is a change of
 * implementation only, never a change of shape.
 *
 * Dates: `DateString` is a calendar day (`YYYY-MM-DD`) with no timezone. Timestamps
 * are full ISO-8601 strings. Keeping them distinct matters because check-ins are keyed
 * by the user's local day, not by an instant.
 */

/** Calendar day, `YYYY-MM-DD`. Postgres `date`. */
export type DateString = string;

/** Full ISO-8601 timestamp. Postgres `timestamptz`. */
export type Timestamp = string;

export type UUID = string;

/** `users` — supplied by Supabase auth. Only the fields the UI reads. */
export interface User {
  id: UUID;
  email: string;
}

/** `goals` (id, user_id, title, why, deadline, created_at) */
export interface Goal {
  id: UUID;
  user_id: UUID;
  title: string;
  /** The reason the goal exists. Repeated on every screen — F6. */
  why: string;
  deadline: DateString;
  created_at: Timestamp;
}

export type MilestoneStatus = "pending" | "hit" | "missed";

/** `milestones` (id, goal_id, title, target_date, status) */
export interface Milestone {
  id: UUID;
  goal_id: UUID;
  title: string;
  target_date: DateString;
  status: MilestoneStatus;
}

/**
 * How often a commitment recurs. v1 only ships `weekly` — the column exists so the
 * schema does not need a migration when daily/monthly land, but the UI must not
 * offer the others yet.
 */
export type Cadence = "weekly";

/** `commitments` (id, goal_id, title, cadence, target_per_week) */
export interface Commitment {
  id: UUID;
  goal_id: UUID;
  title: string;
  cadence: Cadence;
  target_per_week: number;
}

/**
 * Which commitments were hit on a given day. Stored as `jsonb`, keyed by commitment
 * id. A missing key means "not hit" — absence and `false` are treated the same.
 */
export type CommitmentsHit = Record<UUID, boolean>;

/** `checkins` (id, user_id, date, note, commitments_hit jsonb, points, score) */
export interface Checkin {
  id: UUID;
  user_id: UUID;
  date: DateString;
  note: string;
  commitments_hit: CommitmentsHit;
  points: number;
  score: number;
}

/** Pace arithmetic behind a drift verdict — F4. Numeric, never vague. */
export interface PaceMath {
  /** Commitments-per-week the plan demands. */
  required_per_week: number;
  /** Commitments-per-week actually achieved so far. */
  actual_per_week: number;
  days_elapsed: number;
  days_remaining: number;
  /** Total hits recorded against the plan to date. */
  completed: number;
  /** Total hits the plan requires by the deadline. */
  required_total: number;
  /** Deadline implied by the current rate. Null when the rate is zero. */
  projected_completion_date: DateString | null;
}

/** `drift_checks` (id, goal_id, date, verdict, gap_analysis, pace_math jsonb) */
export interface DriftCheck {
  id: UUID;
  goal_id: UUID;
  date: DateString;
  verdict: string;
  gap_analysis: string;
  pace_math: PaceMath;
}

/** `reviews` (id, goal_id, week_start, summary, verdict) */
export interface Review {
  id: UUID;
  goal_id: UUID;
  week_start: DateString;
  summary: string;
  verdict: string;
}

/** `floors` (id, user_id, definition) — the worst-day minimum, F8. */
export interface Floor {
  id: UUID;
  user_id: UUID;
  definition: string;
}

/** `waitlist` (id, email, created_at) */
export interface WaitlistEntry {
  id: UUID;
  email: string;
  created_at: Timestamp;
}

/**
 * Today's single pre-decided action — F2. Derived, never stored: it is computed from
 * the week's commitments and the check-ins already logged, so it has no table in §6.
 */
export interface TodayAction {
  commitment_id: UUID;
  /** The imperative sentence shown to the user. Never blank. */
  action: string;
  /** Hits logged against this commitment so far this week. */
  done_this_week: number;
  target_per_week: number;
  /** True once the week's target is met and this is a bonus rep. */
  is_bonus: boolean;
}

/* -------------------------------------------------------------------------- */
/* Write payloads                                                             */
/* -------------------------------------------------------------------------- */

/** Fields the goal-creation flow collects. Server owns id/user_id/created_at. */
export type GoalDraft = Pick<Goal, "title" | "why" | "deadline">;

/** A milestone as entered during goal creation, before it has an id. */
export type MilestoneDraft = Pick<Milestone, "title" | "target_date">;

/** A commitment as entered during goal creation, before it has an id. */
export type CommitmentDraft = Pick<Commitment, "title" | "target_per_week">;

/** The complete output of the three-step goal-creation flow. */
export interface NewGoalInput {
  goal: GoalDraft;
  milestones: MilestoneDraft[];
  commitments: CommitmentDraft[];
}

/** What the daily check-in form submits. Points/score are computed server-side. */
export interface CheckinDraft {
  date: DateString;
  note: string;
  commitments_hit: CommitmentsHit;
}
