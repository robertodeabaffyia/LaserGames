import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmpleadoUpdate } from "@/types/empleados";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("empleados")
    .select(
      `*,
      registros_horas(id, fecha, hora_entrada, hora_salida, horas_trabajadas, notas, created_at)`
    )
    .eq("id", id)
    .order("fecha", { referencedTable: "registros_horas", ascending: false })
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  let body: EmpleadoUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.rol) {
    const rolesValidos = ["administrador", "supervisor", "general"];
    if (!rolesValidos.includes(body.rol)) {
      return NextResponse.json(
        { error: `rol must be one of: ${rolesValidos.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("empleados")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe un empleado con ese DNI" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

/** Soft-delete: marks es_activo = false instead of deleting the row */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("empleados")
    .update({ es_activo: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}

