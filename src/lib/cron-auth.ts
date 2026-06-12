import type { NextRequest } from "next/server";

/**
 * Authorizes a cron request via `Authorization: Bearer <CRON_SECRET>`.
 *
 * Fail-closed in production: if CRON_SECRET is not configured, every request
 * is rejected — a missing env var must never leave mass-messaging endpoints
 * open to the internet. In dev/test (NODE_ENV !== "production") requests are
 * allowed without the secret so local runs and tests work out of the box.
 */
export function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
