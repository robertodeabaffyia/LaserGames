import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  requireUser,
  unauthorizedResponse,
  forbiddenResponse,
  getUserRol,
  hasMinRole,
} from "@/lib/auth-helpers";

interface OrdenEntry {
  id: string;
  orden: number;
}

const FORBIDDEN_MSG = "Solo administradores pueden reordenar paquetes";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "admin")) return forbiddenResponse(FORBIDDEN_MSG);

  let body: OrdenEntry[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json(
      { error: "Body must be a non-empty array of {id, orden}" },
      { status: 400 }
    );
  }

  if (body.some((e) => typeof e.id !== "string" || typeof e.orden !== "number")) {
    return NextResponse.json(
      { error: "Each entry must have id (string) and orden (number)" },
      { status: 400 }
    );
  }

  const results = await Promise.all(
    body.map(({ id, orden }) =>
      supabase.from("paquetes").update({ orden }).eq("id", id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}
