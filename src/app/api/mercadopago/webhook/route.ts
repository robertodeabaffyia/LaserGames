import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeWebhook } from "@/lib/webhook-auth";
import { obtenerPago } from "@/lib/mercadopago";
import { enviarWhatsApp } from "@/lib/notificaciones";
import { formatMoneda } from "@/lib/moneda";

/**
 * Mercado Pago payment notification webhook (Checkout Pro).
 * Configured as notification_url on each preference:
 *   POST {APP_BASE_URL}/api/mercadopago/webhook?token={WEBHOOK_SECRET}
 *
 * Security: the notification payload is NEVER trusted — only the payment id
 * is taken from it; the status and external_reference come from re-fetching
 * the payment from the MP API with our access token. Always answers 200 for
 * ignorable events so MP stops retrying.
 */
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

  const esPago =
    body?.type === "payment" || searchParams.get("topic") === "payment";
  const paymentId: string | undefined =
    body?.data?.id ?? searchParams.get("id") ?? undefined;

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
  const reservaId = pago.externalReference;

  const { data: reserva } = await supabase
    .from("escape_reservas")
    .select("id, estado, sena_monto, sena_pagada, fecha, hora_inicio, contacto:escape_contactos(nombre, telefono), sala:salas_escape(nombre)")
    .eq("id", reservaId)
    .maybeSingle();

  if (!reserva) {
    return NextResponse.json({ ok: true, skipped: true, reason: "reserva no encontrada" });
  }
  if (reserva.sena_pagada) {
    // Duplicate notification — idempotent no-op.
    return NextResponse.json({ ok: true, skipped: true, reason: "ya confirmada" });
  }

  const { error: updateError } = await supabase
    .from("escape_reservas")
    .update({
      sena_pagada: true,
      mp_payment_id: String(paymentId),
      ...(reserva.estado === "pendiente_sena" && { estado: "reservada" }),
    })
    .eq("id", reservaId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Reset the bot conversation and notify the customer.
  const contacto = reserva.contacto as unknown as { nombre: string; telefono: string | null } | null;
  const sala = reserva.sala as unknown as { nombre: string } | null;

  if (contacto?.telefono) {
    const telefonoDigits = contacto.telefono.replace(/\D/g, "");
    await supabase
      .from("whatsapp_conversaciones")
      .update({ estado: "inicio", datos: {}, reserva_id: null })
      .eq("telefono", telefonoDigits);

    const [y, m, d] = String(reserva.fecha).split("-");
    await enviarWhatsApp(
      contacto.telefono,
      `¡Seña recibida! ✅ Tu reserva está confirmada:\n` +
        `🗝️ ${sala?.nombre ?? "Escape Room"}\n` +
        `📅 ${d}/${m}/${y} a las ${String(reserva.hora_inicio).slice(0, 5)} hs\n` +
        `💵 Seña pagada: ${formatMoneda(reserva.sena_monto)}\n\n` +
        `¡Te esperamos!`
    );
  }

  return NextResponse.json({ ok: true, confirmada: true });
}
