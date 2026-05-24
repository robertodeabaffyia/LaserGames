import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getUserRol,
  hasMinRole,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth-helpers";
import type { BonoEmpleadoInsert } from "@/types/caja";

const FORBIDDEN_MSG =
  "Acceso restringido a supervisores o administradores";

/** GET — list bonos, optionally filtered by empleado_id or mes */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // ── Auth + role guard ─────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) return forbiddenResponse(FORBIDDEN_MSG);

  const { searchParams } = new URL(request.url);
  const empleado_id = searchParams.get("empleado_id");
  const mes         = searchParams.get("mes");

  let query = supabase
    .from("bonos_empleados")
    .select("*, empleado:empleados(id, nombre)")
    .order("created_at", { ascending: false });

  if (empleado_id) query = query.eq("empleado_id", empleado_id);
  if (mes)         query = query.eq("mes", mes);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — assign a bono to an empleado */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // ── Auth + role guard ─────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) return forbiddenResponse(FORBIDDEN_MSG);

  let body: BonoEmpleadoInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.empleado_id) {
    return NextResponse.json({ error: "empleado_id is required" }, { status: 400 });
  }

  if (!body.mes || !/^\d{4}-\d{2}$/.test(body.mes)) {
    return NextResponse.json(
      { error: "mes is required and must be in format YYYY-MM" },
      { status: 400 }
    );
  }

  if (!body.monto_bono || body.monto_bono <= 0) {
    return NextResponse.json({ error: "monto_bono must be > 0" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bonos_empleados")
    .insert({
      empleado_id: body.empleado_id,
      mes: body.mes,
      monto_bono: body.monto_bono,
      descripcion: body.descripcion ?? null,
      creado_por: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
