import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorizedResponse } from "@/lib/auth-helpers";
import type { EmpleadoInsert } from "@/types/empleados";

/** Escapes ILIKE metacharacters to prevent ReDoS-style pattern amplification. */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const activo = searchParams.get("activo");

  let query = supabase
    .from("empleados")
    .select("*")
    .order("nombre", { ascending: true });

  if (q) {
    const escaped = escapeLike(q);
    query = query.or(
      `nombre.ilike.%${escaped}%,telefono.ilike.%${escaped}%,dni.ilike.%${escaped}%`
    );
  }

  if (activo !== null) {
    query = query.eq("es_activo", activo === "true");
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  let body: EmpleadoInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "nombre is required" }, { status: 400 });
  }
  if (!body.rol) {
    return NextResponse.json({ error: "rol is required" }, { status: 400 });
  }
  const rolesValidos = ["administrador", "supervisor", "general"];
  if (!rolesValidos.includes(body.rol)) {
    return NextResponse.json(
      { error: `rol must be one of: ${rolesValidos.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("empleados")
    .insert(body)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe un empleado con ese DNI" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
