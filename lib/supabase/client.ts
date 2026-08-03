import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Deliberately outside `lib/data/` — that folder is the data-access seam the UI talks
 * to, and it should depend on this, never the reverse. Nothing outside `lib/data/`
 * should import this module.
 *
 * Both env vars are `NEXT_PUBLIC_` on purpose: they ship in the browser bundle, and
 * Row Level Security is what protects the data. The `service_role` key must never
 * appear here — it bypasses every policy.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail loudly at the call site rather than sending `undefined` to Supabase and
  // getting an opaque network error back.
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the dev server.",
    );
  }

  return createBrowserClient(url, anonKey);
}
