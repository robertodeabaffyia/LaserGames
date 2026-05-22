import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NotificacionTipo } from "@/types/notificaciones";

const VALID_TIPOS: NotificacionTipo[] = [
  "evento_recordatorio",
  "promocion_cumpleanos",
  "confirmacion_evento",
];

/** GET — list unsubscribes, optionally filtered by cliente_id or tipo */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const cliente_id = searchParams.get("cliente_id");
  const tipo       = searchParams.get("tipo");

  let query = supabase
    .from("cliente_desuscripciones")
    .select("*, cliente:clientes(id, nombre)")
    .order("updated_at", { ascending: false });

  if (cliente_id) query = query.eq("cliente_id", cliente_id);
  if (tipo)       query = query.eq("tipo_notificacion", tipo);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — upsert a client unsubscribe preference */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  let body: { cliente_id?: string; tipo_notificacion?: string; desuscrito?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.cliente_id) {
    return NextResponse.json({ error: "cliente_id is required" }, { status: 400 });
  }

  if (!body.tipo_notificacion || !VALID_TIPOS.includes(body.tipo_notificacion as NotificacionTipo)) {
    return NextResponse.json(
      { error: `tipo_notificacion must be one of: ${VALID_TIPOS.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("cliente_desuscripciones")
    .upsert(
      {
        cliente_id: body.cliente_id,
        tipo_notificacion: body.tipo_notificacion,
        desuscrito: body.desuscrito ?? true,
      },
      { onConflict: "cliente_id,tipo_notificacion" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 200 });
}

/** DELETE — remove an unsubscribe record (re-subscribe) */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const cliente_id        = searchParams.get("cliente_id");
  const tipo_notificacion = searchParams.get("tipo");

  if (!cliente_id || !tipo_notificacion) {
    return NextResponse.json(
      { error: "cliente_id and tipo query params are required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("cliente_desuscripciones")
    .delete()
    .eq("cliente_id", cliente_id)
    .eq("tipo_notificacion", tipo_notificacion);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
