import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularPrecioTotal, hayConflicto } from "@/lib/eventos";
import { unauthorizedResponse } from "@/lib/auth-helpers";
import type { EventoInsert } from "@/types/eventos";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const cliente_id = searchParams.get("cliente_id");
  const fecha_inicio = searchParams.get("fecha_inicio");
  const fecha_fin = searchParams.get("fecha_fin");

  let query = supabase
    .from("eventos")
    .select(
      `*,
      cliente:clientes(id, nombre, telefono),
      paquete:paquetes(id, nombre, precio, duracion_horas, duracion_minutos, cantidad_ninos_incluidos, cantidad_adultos_incluidos),
      pagos(id, monto, monto_final, metodo, fecha_pago)`
    )
    .order("fecha_evento", { ascending: true });

  if (estado) query = query.eq("estado", estado);
  if (cliente_id) query = query.eq("cliente_id", cliente_id);
  if (fecha_inicio) query = query.gte("fecha_evento", fecha_inicio);
  if (fecha_fin) query = query.lte("fecha_evento", fecha_fin);

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

  let body: EventoInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.cliente_id)
    return NextResponse.json({ error: "cliente_id is required" }, { status: 400 });
  if (!body.paquete_id)
    return NextResponse.json({ error: "paquete_id is required" }, { status: 400 });
  if (!body.fecha_evento)
    return NextResponse.json({ error: "fecha_evento is required" }, { status: 400 });
  if (!body.nombre_festejado)
    return NextResponse.json({ error: "nombre_festejado is required" }, { status: 400 });

  const { data: paquete, error: paqueteError } = await supabase
    .from("paquetes")
    .select("precio, duracion_horas, duracion_minutos, cantidad_ninos_incluidos, cantidad_adultos_incluidos")
    .eq("id", body.paquete_id)
    .single();

  if (paqueteError || !paquete) {
    return NextResponse.json({ error: "Paquete not found" }, { status: 404 });
  }

  const { data: existingEventos } = await supabase
    .from("eventos")
    .select("id, fecha_evento, duracion_horas, duracion_minutos")
    .not("estado", "eq", "cancelado");

  const proposed = {
    fecha_evento: body.fecha_evento,
    duracion_horas: paquete.duracion_horas,
    duracion_minutos: paquete.duracion_minutos,
  };

  if (hayConflicto(proposed, existingEventos ?? [])) {
    return NextResponse.json(
      { error: "El horario se traslapa con otro evento existente" },
      { status: 409 }
    );
  }

  const precio_total = calcularPrecioTotal({
    precioPaquete: paquete.precio,
    cantidadNinosTotales: body.cantidad_ninos_totales ?? 0,
    ninosIncluidos: paquete.cantidad_ninos_incluidos ?? 0,
    precioNinoExtra: body.precio_nino_extra ?? 0,
    cantidadAdultosTotales: body.cantidad_adultos_totales ?? 0,
    adultosIncluidos: paquete.cantidad_adultos_incluidos ?? 0,
    precioAdulto: body.precio_adulto ?? 0,
    descuento: body.descuento ?? 0,
  });

  const { data, error } = await supabase
    .from("eventos")
    .insert({
      ...body,
      duracion_horas: paquete.duracion_horas,
      duracion_minutos: paquete.duracion_minutos,
      precio_total,
      estado: body.estado ?? "pendiente",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
