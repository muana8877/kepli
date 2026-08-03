import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh and route protection.
 *
 * Named `proxy`, not `middleware`: Next 16 renamed the convention. The runtime is
 * always `nodejs` here and cannot be configured.
 *
 * Two jobs, in order:
 *   1. Refresh the Supabase auth token and write the rotated cookie onto the
 *      response. Server Components cannot set cookies, so if this does not happen
 *      here, sessions expire and users get logged out mid-visit.
 *   2. Redirect unauthenticated users away from app routes.
 */

/** Routes reachable while signed out. Everything else requires a session. */
const PUBLIC_ROUTES = ["/waitlist", "/login", "/auth"];

export async function proxy(request: NextRequest) {
  // Must start from the incoming request so cookies set below survive on the
  // response we eventually return.
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // A non-null assertion would be erased at runtime and let `undefined` reach the
  // Supabase client, which throws a generic "URL and Key are required" from inside
  // the library. Name the missing variable instead — this runs on every request, so
  // getting it wrong takes the whole site down and the message is all you have.
  if (!url || !anonKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Missing env var(s): ${missing}. Set them in the hosting provider's environment settings and redeploy — NEXT_PUBLIC_* values are inlined at build time.`,
    );
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token against Supabase. getSession() only reads the
  // cookie, which a client can forge — never use it to gate access.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    // Remember where they were headed so login can return them there.
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // A signed-in user has no reason to see the login page.
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  /**
   * Skip static assets and image optimisation. Without this the auth check would run
   * on every CSS, JS and image request — slow, and capable of blocking assets from
   * loading at all.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
