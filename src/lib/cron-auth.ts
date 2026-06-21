import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Constant-time string comparison to avoid leaking the secret via response
 * timing. Returns early only on a length mismatch (the length of a Bearer
 * token is not itself sensitive); equal-length inputs are always compared in
 * full so an attacker cannot recover the secret byte-by-byte.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Authorizes a cron request via `Authorization: Bearer <CRON_SECRET>`.
 *
 * Fail-closed in production: if CRON_SECRET is not configured, every request
 * is rejected — a missing env var must never leave mass-messaging endpoints
 * open to the internet. In dev/test (NODE_ENV !== "production") requests are
 * allowed without the secret so local runs and tests work out of the box.
 *
 * The token is compared in constant time (see safeEqual) to prevent timing
 * side-channels from revealing CRON_SECRET.
 */
export function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`);
}
