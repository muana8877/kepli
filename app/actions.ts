"use server";

import { revalidatePath } from "next/cache";
import type { CheckinDraft, NewGoalInput } from "@/types";
import { createGoal, saveCheckin } from "@/lib/data";

/**
 * Server Actions — how Client Components reach the server-only data layer.
 *
 * These are reachable by direct POST, not only through the UI, so each one must
 * verify auth itself rather than trusting that `proxy.ts` already did. Both
 * `createGoal` and `saveCheckin` call `requireUserId()` internally, which throws when
 * there is no session; RLS then independently scopes every row to `auth.uid()`.
 *
 * Errors are returned as values rather than thrown. A thrown error in a Server Action
 * reaches the client as a generic "unexpected response" with the message stripped in
 * production, which gives the user nothing to act on.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createGoalAction(
  input: NewGoalInput,
): Promise<ActionResult> {
  // Validate on the server too. The wizard already blocks empty fields, but a direct
  // POST bypasses the form entirely.
  if (!input.goal.title.trim() || !input.goal.why.trim() || !input.goal.deadline) {
    return { ok: false, error: "Title, why and deadline are all required." };
  }
  if (input.commitments.length === 0) {
    return { ok: false, error: "Add at least one weekly commitment." };
  }

  try {
    await createGoal(input);
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }

  // The goal banner is rendered by the app layout, so every route shows stale data
  // until the whole tree is revalidated.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveCheckinAction(
  draft: CheckinDraft,
): Promise<ActionResult> {
  if (!draft.date) {
    return { ok: false, error: "Missing date." };
  }

  try {
    await saveCheckin(draft);
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }

  // Today's action and the week's counts both derive from check-ins.
  revalidatePath("/", "layout");
  return { ok: true };
}

function messageFor(error: unknown): string {
  if (error instanceof Error && error.message === "Not signed in.") {
    return "Your session expired. Sign in again.";
  }
  return "Could not save that. Try again in a moment.";
}
