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
import { createClient } from "@/lib/supabase/client";
import {
  MOCK_CHECKINS,
  MOCK_COMMITMENTS,
  MOCK_GOAL,
  MOCK_MILESTONES,
  MOCK_USER,
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

/** Stand-in for the authenticated user. Replaced by the Supabase session in Phase 2. */
export async function getCurrentUserId(): Promise<UUID> {
  return MOCK_USER.id;
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
  const userId = await getCurrentUserId();
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
  const userId = await getCurrentUserId();
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
 * Waitlist signup — the first real write in the app.
 *
 * The `waitlist` table has RLS on with an insert-only policy and deliberately no
 * select policy, so this client can add an address but can never read the list back.
 */
export async function joinWaitlist(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidEmail(email)) {
    return { ok: false, error: "That does not look like an email address." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("waitlist")
    // Normalised so "Me@Example.com" and "me@example.com" collide on the unique
    // index rather than creating two rows.
    .insert({ email: email.trim().toLowerCase() });

  // 23505 is a unique violation: the address is already on the list. That is the
  // outcome the user wanted, so report success rather than an error they cannot act on.
  if (error && error.code !== "23505") {
    return { ok: false, error: "Could not save that. Try again in a moment." };
  }

  return { ok: true };
}

export function isValidEmail(value: string): boolean {
  // Deliberately permissive: catches typos and obvious junk without rejecting the
  // long tail of technically-valid addresses.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

let idCounter = 0;
function newId(prefix: string): UUID {
  idCounter += 1;
  return `${prefix}-local-${idCounter}`;
}
