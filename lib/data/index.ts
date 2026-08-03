import type {
  Checkin,
  CheckinDraft,
  Commitment,
  DateString,
  Goal,
  Milestone,
  NewGoalInput,
  TodayAction,
  UUID,
} from "@/types";
import { deriveTodayAction } from "@/lib/today-action";
import { today } from "@/lib/date";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  MOCK_CHECKINS,
  MOCK_COMMITMENTS,
  MOCK_GOAL,
  MOCK_MILESTONES,
} from "./mock";

/**
 * The data layer. Every read and write the UI performs goes through this module —
 * no component imports `./mock` directly, and none will import a Supabase client
 * directly either.
 *
 * Phase 1 returns fixtures. Phase 2 replaces the bodies of these functions with
 * Supabase queries; the signatures are already async and already return the same
 * shapes, so no calling code changes.
 *
 * In-memory writes: mutations append to module-level arrays. That state lives in the
 * server process and is lost on reload, which is correct for Phase 1 — the screens
 * carry their own local state for anything the user needs to see persist within a
 * session. These functions exist so the call sites are real now.
 */

const goals: Goal[] = [MOCK_GOAL];
const milestones: Milestone[] = [...MOCK_MILESTONES];
const commitments: Commitment[] = [...MOCK_COMMITMENTS];
const checkins: Checkin[] = [...MOCK_CHECKINS];

/**
 * The signed-in user's id, or null when signed out.
 *
 * Uses `getUser()`, which revalidates the token with Supabase. `getSession()` only
 * decodes the cookie, which the client controls, so it must never gate access.
 */
export async function getCurrentUserId(): Promise<UUID | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * The signed-in user's id, or throw. Use for writes: `proxy.ts` already redirects
 * signed-out visitors, so reaching a write without a session means something is
 * wrong, and failing loudly beats attributing a row to the wrong person.
 */
async function requireUserId(): Promise<UUID> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not signed in.");
  return userId;
}

/**
 * The goal shown in the persistent banner (F6). v1 assumes one active goal per user;
 * when several exist this returns the most recently created.
 */
export async function getActiveGoal(): Promise<Goal | null> {
  if (goals.length === 0) return null;
  return [...goals].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
}

export async function getMilestones(goalId: UUID): Promise<Milestone[]> {
  return milestones
    .filter((m) => m.goal_id === goalId)
    .sort((a, b) => a.target_date.localeCompare(b.target_date));
}

export async function getCommitments(goalId: UUID): Promise<Commitment[]> {
  return commitments.filter((c) => c.goal_id === goalId);
}

/** Check-ins newest first. */
export async function getCheckins(): Promise<Checkin[]> {
  return [...checkins].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getCheckinByDate(
  date: DateString,
): Promise<Checkin | null> {
  return checkins.find((c) => c.date === date) ?? null;
}

/** F2 — today's single pre-decided action, derived from the week's commitments. */
export async function getTodayAction(): Promise<TodayAction | null> {
  const goal = await getActiveGoal();
  if (!goal) return null;
  const [goalCommitments, history] = await Promise.all([
    getCommitments(goal.id),
    getCheckins(),
  ]);
  return deriveTodayAction(goalCommitments, history);
}

/**
 * Create a goal with its milestones and commitments. In Phase 2 this becomes a single
 * transaction so a half-created goal is impossible.
 */
export async function createGoal(input: NewGoalInput): Promise<Goal> {
  const userId = await requireUserId();
  const goalId = newId("goal");

  const goal: Goal = {
    id: goalId,
    user_id: userId,
    title: input.goal.title,
    why: input.goal.why,
    deadline: input.goal.deadline,
    created_at: new Date().toISOString(),
  };
  goals.push(goal);

  for (const draft of input.milestones) {
    milestones.push({
      id: newId("milestone"),
      goal_id: goalId,
      title: draft.title,
      target_date: draft.target_date,
      status: "pending",
    });
  }

  for (const draft of input.commitments) {
    commitments.push({
      id: newId("commitment"),
      goal_id: goalId,
      title: draft.title,
      cadence: "weekly",
      target_per_week: draft.target_per_week,
    });
  }

  return goal;
}

/**
 * Record a check-in, replacing any existing one for the same date — a user correcting
 * today's entry should not create a second row.
 *
 * Scoring is a placeholder: 10 points per commitment hit, plus 5 for showing up.
 * F5 defines the real rules and is out of Phase 1 scope.
 */
export async function saveCheckin(draft: CheckinDraft): Promise<Checkin> {
  const userId = await requireUserId();
  const hitCount = Object.values(draft.commitments_hit).filter(Boolean).length;
  const points = hitCount * 10 + (hitCount > 0 ? 5 : 0);

  const existingIndex = checkins.findIndex((c) => c.date === draft.date);
  const checkin: Checkin = {
    id: existingIndex >= 0 ? checkins[existingIndex].id : newId("checkin"),
    user_id: userId,
    date: draft.date,
    note: draft.note,
    commitments_hit: draft.commitments_hit,
    points,
    score: points,
  };

  if (existingIndex >= 0) checkins[existingIndex] = checkin;
  else checkins.push(checkin);

  return checkin;
}

/** Today's check-in, if one has been recorded. */
export async function getTodayCheckin(): Promise<Checkin | null> {
  return getCheckinByDate(today());
}

/**
 * Waitlist writes live in `./waitlist` and are imported directly by the public
 * waitlist form. They are deliberately not re-exported here: this module imports the
 * server Supabase client, so anything re-exported from it would drag `next/headers`
 * into the browser bundle and fail the build.
 */

let idCounter = 0;
function newId(prefix: string): UUID {
  idCounter += 1;
  return `${prefix}-local-${idCounter}`;
}
