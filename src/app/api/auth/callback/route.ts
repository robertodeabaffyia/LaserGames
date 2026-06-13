import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase Auth callback. Handles both link formats Supabase emails can use:
 *
 *   ?code=...                  — PKCE flow (exchangeCodeForSession). Only works
 *                                in the same browser that requested the email,
 *                                because the PKCE verifier lives in its cookies.
 *   ?token_hash=...&type=...   — OTP flow (verifyOtp). Works from any browser,
 *                                so recovery links opened from a mail client
 *                                never bounce back to /login.
 *
 * type=recovery lands on /update-password; anything else goes to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(redirectTarget(origin, type, next));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectTarget(origin, type, next));
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "El enlace es inválido o expiró. Pedí uno nuevo desde “¿Olvidaste tu contraseña?”"
    )}`
  );
}

function redirectTarget(origin: string, type: string | null, next: string): string {
  return type === "recovery" ? `${origin}/update-password` : `${origin}${next}`;
}
