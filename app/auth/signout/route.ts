import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign out. POST only — a GET would let any page log the user out with an <img> tag.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), {
    // 303 forces the browser to follow with GET rather than repeating the POST.
    status: 303,
  });
}
