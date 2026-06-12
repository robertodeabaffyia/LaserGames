/**
 * Rate limiting via Upstash Redis.
 *
 * Two limiters:
 *   strictLimiter  — auth endpoints (5 req / 60 s per IP)
 *   generalLimiter — all other API routes (100 req / 60 s per IP)
 *
 * Graceful degradation: if UPSTASH_REDIS_REST_URL / _TOKEN are missing
 * (local dev without an Upstash instance), all checks pass through so
 * development is never blocked.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";

interface Limiters {
  strict: Ratelimit;
  general: Ratelimit;
}

function buildLimiters(): Limiters | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  return {
    strict: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "rl:strict",
    }),
    general: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "60 s"),
      prefix: "rl:general",
    }),
  };
}

// Lazily initialised so tests can inject env vars before the module runs.
let _limiters: Limiters | null | undefined = undefined;

function getLimiters(): Limiters | null {
  if (_limiters === undefined) _limiters = buildLimiters();
  return _limiters;
}

/** Reset cached limiters — only used in tests. */
export function _resetLimiters(): void {
  _limiters = undefined;
}

/**
 * Extracts the real client IP from the request headers.
 * Prefers x-forwarded-for (set by Vercel / reverse proxies).
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

/**
 * Checks the rate limit for a request.
 * Returns a 429 NextResponse if the limit is exceeded, or null if allowed.
 */
export async function checkRateLimit(
  type: "strict" | "general",
  request: NextRequest
): Promise<NextResponse | null> {
  const limiters = getLimiters();
  if (!limiters) return null; // no Upstash config → allow (local dev)

  const limiter = type === "strict" ? limiters.strict : limiters.general;
  const ip = getClientIp(request);
  const { success } = await limiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Demasiados intentos, esperá un momento" },
      { status: 429 }
    );
  }
  return null;
}
