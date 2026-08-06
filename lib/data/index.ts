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

/**
 * The data layer — every authenticated read and write the UI performs.
 *
 * Server-only: this module imports the server Supabase client, which reads cookies.
 * Client Components reach it through the Server Actions in `app/actions.ts`, never by
 * importing it directly. (The public waitlist write lives in `./waitlist` for the
 * same reason, and is deliberately not re-exported here.)
 *
 * Every query relies on RLS rather than filtering by user in application code. The
 * policies in `supabase/migrations/001_schema.sql` scope each table to `auth.uid()`,
 * so a query without a `user_id` filter still returns only the caller's rows — and a
 * bug here cannot leak another user's data.
 */

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
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getMilestones(goalId: UUID): Promise<Milestone[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("goal_id", goalId)
    .order("target_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getCommitments(goalId: UUID): Promise<Commitment[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("commitments")
    .select("*")
    .eq("goal_id", goalId);

  if (error) throw error;
  return data ?? [];
}

/** Check-ins newest first. */
export async function getCheckins(): Promise<Checkin[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .order("date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCheckinByDate(
  date: DateString,
): Promise<Checkin | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  if (error) throw error;
  return data;
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
 * Create a goal with its milestones and commitments.
 *
 * Delegates to the `create_goal_with_plan` Postgres function so all three inserts
 * share one transaction — a failure part-way rolls back the goal too, rather than
 * leaving a goal with no plan attached.
 */
export async function createGoal(input: NewGoalInput): Promise<Goal> {
  await requireUserId();

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .rpc("create_goal_with_plan", {
      p_title: input.goal.title,
      p_why: input.goal.why,
      p_deadline: input.goal.deadline,
      p_milestones: input.milestones,
      p_commitments: input.commitments,
    })
    .single();

  if (error) throw error;
  return data as Goal;
}

/**
 * Record a check-in, replacing any existing one for the same date — a user correcting
 * today's entry should not create a second row. The `unique (user_id, date)`
 * constraint makes the upsert authoritative rather than racy.
 *
 * Scoring is a placeholder: 10 points per commitment hit, plus 5 for showing up.
 * F5 defines the real rules and is out of scope here.
 */
export async function saveCheckin(draft: CheckinDraft): Promise<Checkin> {
  const userId = await requireUserId();
  const hitCount = Object.values(draft.commitments_hit).filter(Boolean).length;
  const points = hitCount * 10 + (hitCount > 0 ? 5 : 0);

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("checkins")
    .upsert(
      {
        user_id: userId,
        date: draft.date,
        note: draft.note,
        commitments_hit: draft.commitments_hit,
        points,
        score: points,
      },
      { onConflict: "user_id,date" },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Today's check-in, if one has been recorded. */
export async function getTodayCheckin(): Promise<Checkin | null> {
  return getCheckinByDate(today());
}
