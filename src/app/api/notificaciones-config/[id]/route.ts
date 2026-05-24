import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getUserRol,
  hasMinRole,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth-helpers";
import type { NotificacionConfigUpdate, NotificacionCanal } from "@/types/notificaciones";

type Params = { params: Promise<{ id: string }> };

const VALID_CANALES: NotificacionCanal[] = ["email", "whatsapp", "ambos"];
const FORBIDDEN_MSG = "Acceso restringido a supervisores o administradores";

/** GET — fetch a single config */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Auth + role guard ─────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) return forbiddenResponse(FORBIDDEN_MSG);

  const { data, error } = await supabase
    .from("notificaciones_config")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json(data);
}

/** PUT — update a notification config */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Auth + role guard ─────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) return forbiddenResponse(FORBIDDEN_MSG);

  let body: NotificacionConfigUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.canal !== undefined && !VALID_CANALES.includes(body.canal)) {
    return NextResponse.json(
      { error: `canal must be one of: ${VALID_CANALES.join(", ")}` },
      { status: 400 }
    );
  }

  if (
    body.dias_anticipacion !== undefined &&
    (body.dias_anticipacion < 0 || !Number.isInteger(body.dias_anticipacion))
  ) {
    return NextResponse.json(
      { error: "dias_anticipacion must be a non-negative integer" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("notificaciones_config")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json(data);
}

/** DELETE — remove a notification config */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Auth + role guard ─────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) return forbiddenResponse(FORBIDDEN_MSG);

  const { error } = await supabase
    .from("notificaciones_config")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
