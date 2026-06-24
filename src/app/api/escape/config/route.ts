import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EscapeConfigUpdate } from "@/types/escapeRoom";

/** GET — return the singleton Escape Room config. */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("escape_config")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(null, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** PUT — update the singleton Escape Room config. Admin only. */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!usuario || usuario.rol !== "admin") {
    return NextResponse.json(
      { error: "Solo administradores pueden modificar la configuración" },
      { status: 403 }
    );
  }

  let body: EscapeConfigUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.hora_inicio_reservas || !body.hora_fin_reservas) {
    return NextResponse.json(
      { error: "hora_inicio_reservas and hora_fin_reservas are required" },
      { status: 400 }
    );
  }
  if (typeof body.duracion_bloque_min !== "number" || body.duracion_bloque_min <= 0) {
    return NextResponse.json(
      { error: "duracion_bloque_min must be a positive number" },
      { status: 400 }
    );
  }
  if (typeof body.sena_minima !== "number" || body.sena_minima < 0) {
    return NextResponse.json(
      { error: "sena_minima must be a non-negative number" },
      { status: 400 }
    );
  }
  if (
    typeof body.recargo_transferencia_pct !== "number" ||
    body.recargo_transferencia_pct < 0
  ) {
    return NextResponse.json(
      { error: "recargo_transferencia_pct must be a non-negative number" },
      { status: 400 }
    );
  }
  if (typeof body.precio_sala_completa !== "number" || body.precio_sala_completa < 0) {
    return NextResponse.json(
      { error: "precio_sala_completa must be a non-negative number" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("escape_config")
    .update({
      hora_inicio_reservas: body.hora_inicio_reservas,
      hora_fin_reservas: body.hora_fin_reservas,
      duracion_bloque_min: body.duracion_bloque_min,
      sena_minima: body.sena_minima,
      recargo_transferencia_pct: body.recargo_transferencia_pct,
      precio_sala_completa: body.precio_sala_completa,
    })
    .eq("id", 1)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
