import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, unauthorizedResponse, getUserRol } from "@/lib/auth-helpers";

/** GET /api/usuarios/me — returns the authenticated user's role. */
export async function GET() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  return NextResponse.json({ rol });
}
