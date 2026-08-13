import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { homeForRole, ROLE_PREFIXES } from "@/config/roles";

/**
 * Security layer 1 of 3 (ARCHITECTURE section 3).
 *
 * This runs before any protected page renders. It is a fast, coarse gate —
 * it stops the obviously-wrong request (no session, suspended account, wrong
 * role, incomplete profile) so the page never gets the chance to leak
 * anything. It is explicitly NOT the only check: every mutation re-derives
 * the caller server-side, and RLS backs both up.
 */

/** Paths reachable without a session. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/login/hod",
  "/login/staff",
  "/register",
  "/register/staff",
  "/forgot-password",
  "/reset-password",
  "/privacy",
];

/**
 * Student paths that stay reachable while the mandatory profile is still
 * incomplete. Everything else the student owns redirects to the gate.
 */
const PROFILE_GATE_EXEMPT = ["/complete-profile"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Keep a single response object so Supabase's refreshed auth cookies are
  // carried through on every branch below. Returning a fresh NextResponse
  // after the session read would silently drop the rotated token and log the
  // user out on the next request.
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Unauthenticated -----------------------------------------------------
  if (!user) {
    if (isPublic(pathname)) return response;

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // --- Authenticated: read role/status from the shadow table ---------------
  // Read from `users`, not from the JWT, so a suspension or role change takes
  // effect on the very next request rather than at token refresh.
  const { data: account } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!account) {
    // Auth identity with no shadow row — the signup trigger did not complete.
    // Fail closed rather than guessing a role.
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "account-incomplete");
    return NextResponse.redirect(loginUrl);
  }

  if (account.status === "suspended" || account.status === "rejected") {
    if (pathname === "/account-blocked") return response;
    return NextResponse.redirect(new URL("/account-blocked", request.url));
  }

  if (account.status === "pending") {
    // Faculty/admin awaiting approval (PRD 5.1). Students are created
    // 'active' by the signup trigger, so they never land here.
    if (pathname === "/pending-approval") return response;
    return NextResponse.redirect(new URL("/pending-approval", request.url));
  }

  const home = homeForRole(account.role);

  // A signed-in user on a login/register page belongs at their own home.
  if (isLoginPath(pathname) || pathname.startsWith("/register")) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // --- Cross-role access ---------------------------------------------------
  const owned = ROLE_PREFIXES.find((entry) => pathname.startsWith(entry.prefix));
  if (owned && owned.role !== account.role) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // --- Student profile gate (PRD 5.2) --------------------------------------
  // Applies to every student-owned path except the gate itself, so a student
  // cannot skip it by deep-linking to a sibling page such as /achievements.
  if (
    account.role === "student" &&
    owned?.role === "student" &&
    !PROFILE_GATE_EXEMPT.some((exempt) => pathname.startsWith(exempt))
  ) {
    const { data: student } = await supabase
      .from("students")
      .select("profile_completion_percent")
      .eq("user_id", user.id)
      .single();

    // Reads the stored percentage rather than recomputing: the server action
    // that writes each section recomputes and persists it in the same call,
    // which keeps this check to one cheap indexed lookup per request.
    if (!student || student.profile_completion_percent < 100) {
      return NextResponse.redirect(new URL("/complete-profile", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. Note this
     * deliberately still matches public pages — the signed-in-user redirect
     * above needs to see them.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
