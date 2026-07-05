import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const SESSION_INACTIVITY_MS = 30 * 60 * 1000;

const LAST_ACTIVITY_COOKIE = "last_activity";

/**
 * API routes that bypass session validation (handle their own auth or are public):
 *   /api/cron/*              — uses Bearer CRON_SECRET
 *   /api/desuscripciones     — unauthenticated unsubscribe links
 *   /api/auth/*              — Supabase Auth callbacks
 *   /api/whatsapp/webhook    — Vonage inbound, uses ?token=WEBHOOK_SECRET
 *   /api/mercadopago/webhook — MP notifications, uses ?token=WEBHOOK_SECRET
 */
const API_EXEMPT_PREFIXES = [
  "/api/cron/",
  "/api/desuscripciones",
  "/api/auth/",
  "/api/whatsapp/webhook",
  "/api/mercadopago/webhook",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Rate limiting ────────────────────────────────────────────────────────
  // Strict limit on login POST (server action invocations): 5 req/60 s per IP.
  // Cron routes are excluded (Vercel-invoked, not user-facing).
  if (pathname === "/login" && request.method === "POST") {
    const limited = await checkRateLimit("strict", request);
    if (limited) return limited;
  }

  // General limit on all API routes except cron (already auth-gated separately).
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/cron/")) {
    const limited = await checkRateLimit("general", request);
    if (limited) return limited;
  }

  // Let exempt API routes through without touching the session
  if (API_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Supabase requires us to mutate cookies on both request and response
  // to keep the session refreshed.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not add any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Session inactivity timeout ───────────────────────────────────────────
  // If 30 minutes pass with no server activity, sign the user out.
  // New sessions (no cookie yet) are never considered expired — the cookie
  // is set on first response and refreshed on every subsequent request.
  if (user) {
    const raw = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    const lastActivity = raw !== undefined ? parseInt(raw, 10) : null;

    if (
      lastActivity !== null &&
      !isNaN(lastActivity) &&
      Date.now() - lastActivity > SESSION_INACTIVITY_MS
    ) {
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set(
        "message",
        "Tu sesión expiró por inactividad"
      );
      const expiredResponse = NextResponse.redirect(loginUrl);
      // Copy the auth-clearing cookies that signOut wrote to supabaseResponse.
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        expiredResponse.cookies.set(cookie.name, cookie.value);
      });
      expiredResponse.cookies.delete(LAST_ACTIVITY_COOKIE);
      return expiredResponse;
    }
  }

  // ── Auth routes ──────────────────────────────────────────────────────────
  // Redirect authenticated users away from login
  if (pathname.startsWith("/login")) {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // ── API routes ───────────────────────────────────────────────────────────
  // Unauthenticated API calls get a 401 (individual routes also check this,
  // but this provides an extra edge-level defense).
  if (pathname.startsWith("/api/") && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Protected page routes ────────────────────────────────────────────────
  // /dashboard/* and /admin/* require authentication
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Config guard ─────────────────────────────────────────────────────────
  // After first login, redirect to /admin/configuracion if no config saved yet.
  // The cookie x-config-ok is set by GET/PUT /api/configuracion when config exists.
  if (
    isProtected &&
    user &&
    !pathname.startsWith("/admin/configuracion") &&
    !request.cookies.has("x-config-ok")
  ) {
    return NextResponse.redirect(
      new URL("/admin/configuracion", request.url)
    );
  }

  // Stamp the current time so the next request can check for inactivity.
  if (user) {
    supabaseResponse.cookies.set(LAST_ACTIVITY_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // Only sent over HTTPS in production; left off in dev so http://localhost works.
      secure: process.env.NODE_ENV === "production",
    });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except Next.js internals and static assets.
     * Includes /api/* so unauthenticated API calls get a 401 at the edge.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
