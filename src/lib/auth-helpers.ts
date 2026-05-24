import { NextResponse } from "next/server";

export type UsuarioRol = "admin" | "supervisor" | "general";

/** Hierarchy weight — higher = more privileged. */
const ROL_WEIGHT: Record<UsuarioRol, number> = {
  admin: 3,
  supervisor: 2,
  general: 1,
};

/**
 * Returns true when `rol` meets or exceeds `minRol` in the hierarchy:
 * admin (3) ≥ supervisor (2) ≥ general (1).
 */
export function hasMinRole(
  rol: UsuarioRol | null,
  minRol: UsuarioRol
): boolean {
  if (!rol) return false;
  return (ROL_WEIGHT[rol] ?? 0) >= ROL_WEIGHT[minRol];
}

/**
 * Fetches the authenticated user's role from the `usuarios` table.
 * Returns null when the row doesn't exist or a DB error occurs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUserRol(
  supabase: any,
  userId: string
): Promise<UsuarioRol | null> {
  const { data } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", userId)
    .single();
  return (data?.rol as UsuarioRol) ?? null;
}

/** Returns a 401 Unauthorized JSON response. */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Returns a 403 Forbidden JSON response. */
export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}
