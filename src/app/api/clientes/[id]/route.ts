import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validarEmail, validarTelefono } from "@/lib/validaciones";
import { unauthorizedResponse } from "@/lib/auth-helpers";
import type { ClienteUpdate } from "@/types/clientes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const { data, error } = await supabase
    .from("clientes")
    .select(
      `*,
      hijos(id, nombre, fecha_nacimiento, notas),
      eventos(
        id, fecha_evento, estado, precio_total, nombre_festejado,
        paquete:paquetes(nombre)
      )`
    )
    .eq("id", id)
    .order("fecha_evento", { referencedTable: "eventos", ascending: false })
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

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  let body: ClienteUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.email && !validarEmail(body.email)) {
    return NextResponse.json({ error: "El formato de email es inválido" }, { status: 400 });
  }

  if (body.telefono && !validarTelefono(body.telefono)) {
    return NextResponse.json(
      { error: "El teléfono debe tener entre 7 y 15 dígitos (formato internacional)" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("clientes")
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

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const { error } = await supabase.from("clientes").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
