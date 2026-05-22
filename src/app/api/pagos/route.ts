import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PagoInsert } from "@/types/pagos";
import type { TarjetaNombre, CuotasClave, TarjetaRecargos } from "@/types/configuracion";

/** GET — list pagos, optionally filtered by evento_id */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
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

/** POST — record a payment, updating evento status based on seña / completion rules */
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

  if (!body.evento_id)
    return NextResponse.json({ error: "evento_id is required" }, { status: 400 });
  if (!body.monto || body.monto <= 0)
    return NextResponse.json({ error: "monto must be > 0" }, { status: 400 });
  if (!body.metodo)
    return NextResponse.json({ error: "metodo is required" }, { status: 400 });

  // Fetch evento
  const { data: evento, error: eventoError } = await supabase
    .from("eventos")
    .select("id, precio_total, estado")
    .eq("id", body.evento_id)
    .single();

  if (eventoError || !evento) {
    return NextResponse.json({ error: "Evento not found" }, { status: 404 });
  }

  // Fetch config for seña amount and tarjeta recargos
  const { data: config } = await supabase
    .from("configuraciones")
    .select("monto_seña, tarjeta_recargos")
    .eq("usuario_id", user.id)
    .single();

  const montoSeña = config?.monto_seña ?? 0;

  // Calculate recargo for tarjeta payments
  let recargo_pct = 0;
  if (body.metodo === "tarjeta" && body.tipo_tarjeta && body.num_cuotas) {
    const recargos = (config?.tarjeta_recargos ?? {}) as TarjetaRecargos;
    const tarjetaKey = body.tipo_tarjeta as TarjetaNombre;
    const cuotasKey = String(body.num_cuotas) as CuotasClave;
    recargo_pct = recargos[tarjetaKey]?.[cuotasKey] ?? 0;
  }

  // Sum existing pagos for this evento
  const { data: existingPagos } = await supabase
    .from("pagos")
    .select("monto")
    .eq("evento_id", body.evento_id);

  const totalPagadoAntes = (existingPagos ?? []).reduce(
    (sum, p) => sum + Number(p.monto),
    0
  );

  // Insert new pago
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
      fecha_pago: body.fecha_pago ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (pagoError) {
    return NextResponse.json({ error: pagoError.message }, { status: 400 });
  }

  // Determine new evento status
  const totalPagadoAhora = totalPagadoAntes + body.monto;
  let nuevoEstado: string | null = null;

  if (totalPagadoAhora >= evento.precio_total) {
    // Fully paid
    nuevoEstado = "completado";
  } else if (totalPagadoAntes === 0 && body.monto >= montoSeña && montoSeña > 0) {
    // First payment covers seña → reserved
    nuevoEstado = "confirmado";
  }

  if (nuevoEstado && nuevoEstado !== evento.estado) {
    await supabase
      .from("eventos")
      .update({ estado: nuevoEstado })
      .eq("id", body.evento_id);
  }

  // Auto-create ingreso movimiento_caja for this payment
  const fechaPago = (body.fecha_pago ?? new Date().toISOString()).slice(0, 10);
  await supabase.from("movimientos_caja").insert({
    usuario_id: user.id,
    tipo: "ingreso",
    categoria: "pago_evento",
    descripcion: `Pago evento (${body.metodo}) — evento ${body.evento_id}`,
    monto: body.monto,
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
