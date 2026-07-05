import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  unauthorizedResponse,
  forbiddenResponse,
  getUserRol,
  hasMinRole,
} from "@/lib/auth-helpers";
import {
  calcularPrecioReserva,
  generarTurnosDisponibles,
  type ReservaExistente,
} from "@/lib/escapeRoom";
import type { EscapeReservaInsert } from "@/types/escapeRoom";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MODOS_COBRO = ["por_persona", "sala_completa"];

/** GET — list reservas, optionally filtered by fecha / sala_id / estado. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get("fecha");
  const sala_id = searchParams.get("sala_id");
  const estado = searchParams.get("estado");

  let query = supabase
    .from("escape_reservas")
    .select(
      `*,
      sala:salas_escape(id, nombre),
      contacto:escape_contactos(id, nombre, telefono, email)`
    )
    .order("fecha", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (fecha) query = query.eq("fecha", fecha);
  if (sala_id) query = query.eq("sala_id", sala_id);
  if (estado) query = query.eq("estado", estado);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — create a reserva. Supervisor+ only. Re-validates the slot and recomputes price server-side. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) {
    return forbiddenResponse("Solo supervisores o administradores pueden crear reservas");
  }

  let body: EscapeReservaInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sala_id) return NextResponse.json({ error: "sala_id is required" }, { status: 400 });
  if (!body.contacto_id) return NextResponse.json({ error: "contacto_id is required" }, { status: 400 });
  if (!body.fecha || !FECHA_RE.test(body.fecha)) {
    return NextResponse.json({ error: "fecha must be a valid YYYY-MM-DD date" }, { status: 400 });
  }
  if (!body.hora_inicio) {
    return NextResponse.json({ error: "hora_inicio is required" }, { status: 400 });
  }
  if (!body.modo_cobro || !MODOS_COBRO.includes(body.modo_cobro)) {
    return NextResponse.json(
      { error: "modo_cobro must be 'por_persona' or 'sala_completa'" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(body.cantidad_personas) || body.cantidad_personas <= 0) {
    return NextResponse.json(
      { error: "cantidad_personas must be a positive integer" },
      { status: 400 }
    );
  }

  const { data: config, error: configError } = await supabase
    .from("escape_config")
    .select("hora_inicio_reservas, hora_fin_reservas, duracion_bloque_min, precio_sala_completa")
    .eq("id", 1)
    .single();

  if (configError || !config) {
    return NextResponse.json({ error: "Escape Room config not found" }, { status: 404 });
  }

  const { data: reservasExistentes, error: reservasError } = await supabase
    .from("escape_reservas")
    .select("sala_id, fecha, hora_inicio, estado")
    .eq("sala_id", body.sala_id)
    .eq("fecha", body.fecha);

  if (reservasError) {
    return NextResponse.json({ error: reservasError.message }, { status: 500 });
  }

  // ── Server-side slot re-validation: never trust the client's chosen time ──
  const turnosDisponibles = generarTurnosDisponibles({
    fecha: body.fecha,
    sala_id: body.sala_id,
    horaInicio: config.hora_inicio_reservas,
    horaFin: config.hora_fin_reservas,
    duracionBloqueMin: config.duracion_bloque_min,
    reservasExistentes: (reservasExistentes ?? []) as ReservaExistente[],
  });

  if (!turnosDisponibles.includes(body.hora_inicio.slice(0, 5))) {
    return NextResponse.json(
      { error: "Este turno ya no está disponible" },
      { status: 409 }
    );
  }

  // ── Server-side price recomputation: never trust a client-sent price ──────
  let precio_total: number;
  try {
    if (body.modo_cobro === "por_persona") {
      const { data: precioRows } = await supabase
        .from("escape_precios_persona")
        .select("cantidad, precio_por_persona")
        .is("sala_id", null);
      const preciosPorPersona = Object.fromEntries(
        (precioRows ?? []).map((r) => [r.cantidad, r.precio_por_persona])
      );
      precio_total = calcularPrecioReserva({
        modo_cobro: "por_persona",
        cantidad_personas: body.cantidad_personas,
        preciosPorPersona,
        precioSalaCompleta: config.precio_sala_completa,
      });
    } else {
      precio_total = calcularPrecioReserva({
        modo_cobro: "sala_completa",
        cantidad_personas: body.cantidad_personas,
        preciosPorPersona: {},
        precioSalaCompleta: config.precio_sala_completa,
      });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al calcular el precio" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("escape_reservas")
    .insert({
      sala_id: body.sala_id,
      contacto_id: body.contacto_id,
      fecha: body.fecha,
      hora_inicio: body.hora_inicio,
      cantidad_personas: body.cantidad_personas,
      modo_cobro: body.modo_cobro,
      precio_total,
      estado: "reservada",
      notas: body.notas ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
