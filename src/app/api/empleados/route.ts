import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmpleadoInsert } from "@/types/empleados";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const activo = searchParams.get("activo");

  let query = supabase
    .from("empleados")
    .select("*")
    .order("nombre", { ascending: true });

  if (q) {
    query = query.or(
      `nombre.ilike.%${q}%,telefono.ilike.%${q}%,dni.ilike.%${q}%`
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
    // Unique violation on DNI
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
