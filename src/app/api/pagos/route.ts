import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PagoInsert } from "@/types/pagos";
import type { TarjetaNombre, CuotasClave, TarjetaRecargos } from "@/types/configuracion";

/** GET — list pagos, optionally filtered by evento_id */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const evento_id = searchParams.get("evento_id");

  let query = supabase
    .from("pagos")
    .select("*")
    .order("fecha_pago", { ascending: true });

  if (evento_id) query = query.eq("evento_id", evento_id);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — record a payment with optional discount, updating evento status */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PagoInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Basic field validation ─────────────────────────────────────────────────

  if (!body.evento_id)
    return NextResponse.json({ error: "evento_id is required" }, { status: 400 });
  if (!body.monto || body.monto <= 0)
    return NextResponse.json({ error: "monto must be > 0" }, { status: 400 });
  if (!body.metodo)
    return NextResponse.json({ error: "metodo is required" }, { status: 400 });

  // ── Discount validation ────────────────────────────────────────────────────

  const tieneDescuento = body.tiene_descuento === true;
  let descuentoAmount = 0;

  if (tieneDescuento) {
    const { tipo_descuento, valor_descuento } = body;

    if (!tipo_descuento || !["porcentaje", "monto"].includes(tipo_descuento)) {
      return NextResponse.json(
        { error: "tipo_descuento must be 'porcentaje' or 'monto' when tiene_descuento is true" },
        { status: 400 }
      );
    }
    if (!valor_descuento || valor_descuento <= 0) {
      return NextResponse.json(
        { error: "valor_descuento must be > 0 when tiene_descuento is true" },
        { status: 400 }
      );
    }

    if (tipo_descuento === "porcentaje") {
      if (valor_descuento > 100) {
        return NextResponse.json(
          { error: "valor_descuento porcentaje cannot exceed 100" },
          { status: 400 }
        );
      }
      descuentoAmount = body.monto * (valor_descuento / 100);
    } else {
      descuentoAmount = valor_descuento;
    }

    const montoFinalPreview = body.monto - descuentoAmount;
    if (montoFinalPreview <= 0) {
      return NextResponse.json(
        { error: "monto_final must be > 0 after applying the discount" },
        { status: 400 }
      );
    }
  }

  const montoFinal = body.monto - descuentoAmount; // equals body.monto when no discount

  // ── Fetch evento ───────────────────────────────────────────────────────────

  const { data: evento, error: eventoError } = await supabase
    .from("eventos")
    .select("id, precio_total, estado")
    .eq("id", body.evento_id)
    .single();

  if (eventoError || !evento) {
    return NextResponse.json({ error: "Evento not found" }, { status: 404 });
  }

  // ── Fetch config ───────────────────────────────────────────────────────────

  const { data: configRaw } = await supabase
    .from("configuraciones")
    .select("*")
    .eq("usuario_id", user.id)
    .single();

  const config = configRaw as { monto_seña?: number; tarjeta_recargos?: TarjetaRecargos } | null;
  const montoSeña = config?.monto_seña ?? 0;

  // Calculate recargo for tarjeta payments
  let recargo_pct = 0;
  if (body.metodo === "tarjeta" && body.tipo_tarjeta && body.num_cuotas) {
    const recargos = (config?.tarjeta_recargos ?? {}) as TarjetaRecargos;
    const tarjetaKey = body.tipo_tarjeta as TarjetaNombre;
    const cuotasKey = String(body.num_cuotas) as CuotasClave;
    recargo_pct = recargos[tarjetaKey]?.[cuotasKey] ?? 0;
  }

  // ── Sum existing pagos using monto_final (backward-compat: fall back to monto) ──

  const { data: existingPagos } = await supabase
    .from("pagos")
    .select("monto, monto_final")
    .eq("evento_id", body.evento_id);

  const totalPagadoAntes = (existingPagos ?? []).reduce(
    (sum, p) => sum + Number((p as { monto_final?: number | null; monto: number }).monto_final ?? p.monto),
    0
  );

  // ── Insert pago ────────────────────────────────────────────────────────────

  const { data: pago, error: pagoError } = await supabase
    .from("pagos")
    .insert({
      evento_id: body.evento_id,
      monto: body.monto,
      metodo: body.metodo,
      tipo_tarjeta: body.tipo_tarjeta ?? null,
      num_cuotas: body.num_cuotas ?? null,
      recargo_pct,
      notas: body.notas ?? null,
      quien_recibio: body.quien_recibio ?? null,
      fecha_pago: body.fecha_pago ?? new Date().toISOString(),
      tiene_descuento: tieneDescuento,
      tipo_descuento: tieneDescuento ? (body.tipo_descuento ?? null) : null,
      valor_descuento: tieneDescuento ? (body.valor_descuento ?? null) : null,
      monto_final: tieneDescuento ? montoFinal : null,
    })
    .select()
    .single();

  if (pagoError) {
    return NextResponse.json({ error: pagoError.message }, { status: 400 });
  }

  // ── Determine new evento status (using montoFinal for balance) ─────────────

  const totalPagadoAhora = totalPagadoAntes + montoFinal;
  let nuevoEstado: string | null = null;

  if (totalPagadoAhora >= evento.precio_total) {
    nuevoEstado = "completado";
  } else if (totalPagadoAntes === 0 && montoFinal >= montoSeña && montoSeña > 0) {
    nuevoEstado = "confirmado";
  }

  if (nuevoEstado && nuevoEstado !== evento.estado) {
    await supabase
      .from("eventos")
      .update({ estado: nuevoEstado })
      .eq("id", body.evento_id);
  }

  // ── Auto-create ingreso movimiento_caja (using montoFinal) ─────────────────

  const fechaPago = (body.fecha_pago ?? new Date().toISOString()).slice(0, 10);
  await supabase.from("movimientos_caja").insert({
    usuario_id: user.id,
    tipo: "ingreso",
    categoria: "pago_evento",
    descripcion: `Pago evento (${body.metodo}) — evento ${body.evento_id}`,
    monto: montoFinal,
    fecha: fechaPago,
    es_repetible: false,
    frecuencia_repeticion: null,
    evento_id: body.evento_id,
    empleado_id: null,
  });

  return NextResponse.json(
    { ...pago, evento_estado: nuevoEstado ?? evento.estado },
    { status: 201 }
  );
}
