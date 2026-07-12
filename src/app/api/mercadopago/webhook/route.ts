import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeWebhook } from "@/lib/webhook-auth";
import { obtenerPago } from "@/lib/mercadopago";
import { enviarWhatsApp } from "@/lib/notificaciones";
import { formatMoneda } from "@/lib/moneda";
import { recalcularEstadoEvento } from "@/lib/pagos";
import { formatFecha } from "@/lib/fecha";

/**
 * Mercado Pago payment notification webhook (Checkout Pro).
 * Configured as notification_url on each preference:
 *   POST {APP_BASE_URL}/api/mercadopago/webhook?token={WEBHOOK_SECRET}
 *
 * The external_reference is either an escape_reservas id or an eventos id
 * (both UUIDs), so the handler tries the escape flow first and falls back to
 * the birthday flow. Security: the notification payload is NEVER trusted —
 * only the payment id is taken from it; status + external_reference come from
 * re-fetching the payment from the MP API. Always answers 200 for ignorable
 * events so MP stops retrying.
 */

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function resetConversacion(supabase: SupabaseAdmin, telefono: string | null) {
  if (!telefono) return;
  await supabase
    .from("whatsapp_conversaciones")
    .update({ estado: "inicio", datos: {}, reserva_id: null })
    .eq("telefono", telefono.replace(/\D/g, ""));
}

/** The single-tenant owner's usuario_id, for stamping cash movements. */
async function resolverUsuarioId(supabase: SupabaseAdmin): Promise<string | null> {
  const { data } = await supabase
    .from("configuraciones")
    .select("usuario_id")
    .limit(1)
    .maybeSingle();
  return (data as { usuario_id?: string } | null)?.usuario_id ?? null;
}

/**
 * Records a seña paid via Mercado Pago as an income movement in the cash flow,
 * mirroring what POST /api/pagos does for manual payments — without this, seña
 * income collected through the WhatsApp bot never reaches the Caja or the
 * financial reports/KPIs.
 */
async function registrarIngresoCaja(
  supabase: SupabaseAdmin,
  params: {
    usuarioId: string | null;
    monto: number;
    descripcion: string;
    fecha: string; // "YYYY-MM-DD"
    eventoId?: string | null;
    pagoId?: string | null;
  }
): Promise<void> {
  if (!params.monto || params.monto <= 0) return;
  await supabase.from("movimientos_caja").insert({
    usuario_id: params.usuarioId,
    tipo: "ingreso",
    categoria: "pago_evento",
    descripcion: params.descripcion,
    monto: params.monto,
    fecha: params.fecha,
    es_repetible: false,
    frecuencia_repeticion: null,
    evento_id: params.eventoId ?? null,
    pago_id: params.pagoId ?? null,
    empleado_id: null,
  });
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Confirms an escape reservation. Returns a response when the reservation
 * exists (newly confirmed or an idempotent duplicate), or null when the
 * external_reference isn't an escape reservation at all.
 */
async function confirmarEscape(
  supabase: SupabaseAdmin,
  externalReference: string,
  paymentId: string
): Promise<NextResponse | null> {
  const { data: reserva } = await supabase
    .from("escape_reservas")
    .select(
      "id, estado, sena_monto, sena_pagada, fecha, hora_inicio, contacto:escape_contactos(nombre, telefono), sala:salas_escape(nombre)"
    )
    .eq("id", externalReference)
    .maybeSingle();

  if (!reserva) return null;
  if (reserva.sena_pagada) {
    return NextResponse.json({ ok: true, skipped: true, reason: "ya confirmada" });
  }

  const { error: updateError } = await supabase
    .from("escape_reservas")
    .update({
      sena_pagada: true,
      mp_payment_id: paymentId,
      ...(reserva.estado === "pendiente_sena" && { estado: "reservada" }),
    })
    .eq("id", externalReference);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const contacto = reserva.contacto as unknown as { nombre: string; telefono: string | null } | null;
  const sala = reserva.sala as unknown as { nombre: string } | null;

  // Escape reservations aren't `eventos` and have no `pagos` row, so the cash
  // entry links to neither — it still records the income in the Caja/reports.
  await registrarIngresoCaja(supabase, {
    usuarioId: await resolverUsuarioId(supabase),
    monto: Number(reserva.sena_monto ?? 0),
    descripcion: `Seña Escape Room (Mercado Pago) — ${sala?.nombre ?? ""} ${formatFecha(reserva.fecha)}`.trim(),
    fecha: hoyISO(),
  });

  await resetConversacion(supabase, contacto?.telefono ?? null);
  if (contacto?.telefono) {
    await enviarWhatsApp(
      contacto.telefono,
      `¡Seña recibida! ✅ Tu reserva está confirmada:\n` +
        `🗝️ ${sala?.nombre ?? "Escape Room"}\n` +
        `📅 ${formatFecha(reserva.fecha)} a las ${String(reserva.hora_inicio).slice(0, 5)} hs\n` +
        `💵 Seña pagada: ${formatMoneda(reserva.sena_monto)}\n\n` +
        `¡Te esperamos!`
    );
  }

  return NextResponse.json({ ok: true, confirmada: true, tipo: "escape" });
}

/**
 * Confirms a birthday event by registering the seña as a `pago` (which drives
 * evento.estado via recalcularEstadoEvento → 'confirmado'). Returns null when
 * the external_reference isn't an event.
 */
async function confirmarCumple(
  supabase: SupabaseAdmin,
  externalReference: string,
  paymentId: string
): Promise<NextResponse | null> {
  const { data: evento } = await supabase
    .from("eventos")
    .select(
      "id, sena_monto, mp_payment_id, fecha_evento, nombre_festejado, cliente:clientes(nombre, telefono), paquete:paquetes(nombre)"
    )
    .eq("id", externalReference)
    .maybeSingle();

  if (!evento) return null;
  if (evento.mp_payment_id) {
    return NextResponse.json({ ok: true, skipped: true, reason: "ya confirmada" });
  }

  // The seña becomes a real payment, so the event balance/estado stay in sync
  // with the rest of the system (manual pagos, reports, etc.).
  const { data: pago, error: pagoError } = await supabase
    .from("pagos")
    .insert({
      evento_id: evento.id,
      monto: evento.sena_monto ?? 0,
      metodo: "mercadopago",
      notas: "Seña pagada por WhatsApp (Mercado Pago)",
    })
    .select("id")
    .single();
  if (pagoError || !pago) {
    return NextResponse.json({ error: pagoError?.message ?? "No se pudo registrar el pago" }, { status: 500 });
  }

  await supabase.from("eventos").update({ mp_payment_id: paymentId }).eq("id", evento.id);

  const cliente = evento.cliente as unknown as { nombre: string; telefono: string | null } | null;
  const paquete = evento.paquete as unknown as { nombre: string } | null;

  // Mirror POST /api/pagos: record the income in the Caja, linked to the
  // evento + pago so an eventual deletion can reconcile it.
  const usuarioId = await resolverUsuarioId(supabase);
  await registrarIngresoCaja(supabase, {
    usuarioId,
    monto: Number(evento.sena_monto ?? 0),
    descripcion: `Seña cumpleaños (Mercado Pago) — ${evento.nombre_festejado}`,
    fecha: hoyISO(),
    eventoId: evento.id,
    pagoId: pago.id,
  });

  // Same owner id drives the seña threshold when recomputing the estado.
  await recalcularEstadoEvento(supabase, evento.id, usuarioId ?? "");

  await resetConversacion(supabase, cliente?.telefono ?? null);
  if (cliente?.telefono) {
    await enviarWhatsApp(
      cliente.telefono,
      `¡Seña recibida! ✅ Tu reserva de cumpleaños está confirmada:\n` +
        `🎉 ${paquete?.nombre ?? "Cumpleaños"}\n` +
        `🎂 Festejado/a: ${evento.nombre_festejado}\n` +
        `📅 ${formatFecha(evento.fecha_evento)}\n` +
        `💵 Seña pagada: ${formatMoneda(evento.sena_monto)}\n\n` +
        `¡Te esperamos!`
    );
  }

  return NextResponse.json({ ok: true, confirmada: true, tipo: "cumpleanos" });
}

export async function POST(request: NextRequest) {
  if (!authorizeWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // MP sends the payment id either in the JSON body ({ type, data: { id } })
  // or as query params (?topic=payment&id=...), depending on notification age.
  const { searchParams } = new URL(request.url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    // Query-param style notifications have no JSON body — fine.
  }

  const esPago = body?.type === "payment" || searchParams.get("topic") === "payment";
  const paymentId: string | undefined = body?.data?.id ?? searchParams.get("id") ?? undefined;

  if (!esPago || !paymentId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const pago = await obtenerPago(String(paymentId));
  if (!pago.ok) {
    // 500 so MP retries later — transient API failures shouldn't drop payments.
    return NextResponse.json({ error: pago.error }, { status: 500 });
  }

  if (pago.status !== "approved" || !pago.externalReference) {
    return NextResponse.json({ ok: true, skipped: true, status: pago.status });
  }

  const supabase = createAdminClient();
  const ref = pago.externalReference;
  const pid = String(paymentId);

  const escapeResult = await confirmarEscape(supabase, ref, pid);
  if (escapeResult) return escapeResult;

  const cumpleResult = await confirmarCumple(supabase, ref, pid);
  if (cumpleResult) return cumpleResult;

  return NextResponse.json({ ok: true, skipped: true, reason: "referencia no encontrada" });
}
