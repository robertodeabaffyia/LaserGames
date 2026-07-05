import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Constant-time comparison — same rationale as src/lib/cron-auth.ts. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Authorizes an external webhook (Vonage WhatsApp inbound, Mercado Pago
 * notifications) via a `?token=<WEBHOOK_SECRET>` query parameter — these
 * providers can't send custom Authorization headers, so the shared secret
 * travels in the URL configured on each provider's dashboard.
 *
 * Fail-closed in production: if WEBHOOK_SECRET is not configured, every
 * request is rejected. In dev/test requests are allowed without the secret
 * so local runs and tests work out of the box (same policy as cron-auth).
 */
export function authorizeWebhook(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return safeEqual(token, secret);
}
