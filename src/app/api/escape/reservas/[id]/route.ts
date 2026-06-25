import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  unauthorizedResponse,
  forbiddenResponse,
  getUserRol,
  hasMinRole,
} from "@/lib/auth-helpers";
import { calcularPrecioReserva } from "@/lib/escapeRoom";
import { ESTADOS_RESERVA, type EscapeReservaUpdate } from "@/types/escapeRoom";

type Params = { params: Promise<{ id: string }> };

const MODOS_COBRO = ["por_persona", "sala_completa"];

/**
 * PUT — edit a reserva. Supervisor+ only. Only cantidad_personas, modo_cobro,
 * estado and notas may change here — sala_id/fecha/hora_inicio are fixed once
 * booked (changing the slot would need turno re-validation, out of scope for
 * this tanda). Recomputes precio_total server-side whenever cantidad_personas
 * or modo_cobro changes.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) {
    return forbiddenResponse("Solo supervisores o administradores pueden editar reservas");
  }

  let body: EscapeReservaUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.modo_cobro !== undefined && !MODOS_COBRO.includes(body.modo_cobro)) {
    return NextResponse.json(
      { error: "modo_cobro must be 'por_persona' or 'sala_completa'" },
      { status: 400 }
    );
  }
  if (
    body.cantidad_personas !== undefined &&
    (!Number.isInteger(body.cantidad_personas) || body.cantidad_personas <= 0)
  ) {
    return NextResponse.json(
      { error: "cantidad_personas must be a positive integer" },
      { status: 400 }
    );
  }
  if (body.estado !== undefined && !ESTADOS_RESERVA.includes(body.estado)) {
    return NextResponse.json(
      { error: `estado must be one of: ${ESTADOS_RESERVA.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: current, error: currentError } = await supabase
    .from("escape_reservas")
    .select("cantidad_personas, modo_cobro")
    .eq("id", id)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: "Reserva not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  if (body.notas !== undefined) updates.notas = body.notas;
  if (body.estado !== undefined) updates.estado = body.estado;

  const pricingChanged = body.cantidad_personas !== undefined || body.modo_cobro !== undefined;
  if (pricingChanged) {
    const modo_cobro = body.modo_cobro ?? current.modo_cobro;
    const cantidad_personas = body.cantidad_personas ?? current.cantidad_personas;

    const { data: config, error: configError } = await supabase
      .from("escape_config")
      .select("precio_sala_completa")
      .eq("id", 1)
      .single();

    if (configError || !config) {
      return NextResponse.json({ error: "Escape Room config not found" }, { status: 404 });
    }

    try {
      if (modo_cobro === "por_persona") {
        const { data: precioRows } = await supabase
          .from("escape_precios_persona")
          .select("cantidad, precio_por_persona")
          .is("sala_id", null);
        const preciosPorPersona = Object.fromEntries(
          (precioRows ?? []).map((r) => [r.cantidad, r.precio_por_persona])
        );
        updates.precio_total = calcularPrecioReserva({
          modo_cobro: "por_persona",
          cantidad_personas,
          preciosPorPersona,
          precioSalaCompleta: config.precio_sala_completa,
        });
      } else {
        updates.precio_total = calcularPrecioReserva({
          modo_cobro: "sala_completa",
          cantidad_personas,
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

    updates.cantidad_personas = cantidad_personas;
    updates.modo_cobro = modo_cobro;
  }

  const { data, error } = await supabase
    .from("escape_reservas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

/** DELETE — remove a reserva. Supervisor+ only. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) {
    return forbiddenResponse("Solo supervisores o administradores pueden eliminar reservas");
  }

  const { error } = await supabase.from("escape_reservas").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
