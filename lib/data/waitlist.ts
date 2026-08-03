import { createClient } from "@/lib/supabase/client";

/**
 * Waitlist writes. Split out from `lib/data/index.ts` because this is the one part of
 * the data layer called from a Client Component.
 *
 * `index.ts` imports the server Supabase client, which pulls in `next/headers` and
 * cannot be bundled for the browser. Keeping the waitlist here lets the public page
 * stay client-rendered while every authenticated read stays server-only.
 */

export function isValidEmail(value: string): boolean {
  // Deliberately permissive: catches typos and obvious junk without rejecting the
  // long tail of technically-valid addresses.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Add an address to the waitlist.
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
