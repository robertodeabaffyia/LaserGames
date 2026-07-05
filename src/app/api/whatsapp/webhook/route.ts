import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeWebhook } from "@/lib/webhook-auth";
import { enviarWhatsApp } from "@/lib/notificaciones";
import { crearLinkPagoSena } from "@/lib/mercadopago";
import {
  generarTurnosDisponibles,
  validarTurnoPersonalizado,
  type ReservaExistente,
} from "@/lib/escapeRoom";
import {
  procesarMensaje,
  type BotContexto,
  type CrearReservaBotParams,
  type CrearReservaBotResult,
  type DatosConversacion,
  type EstadoConversacion,
} from "@/lib/escapeWhatsappBot";

/**
 * Vonage Messages API inbound webhook — the entry point of the WhatsApp
 * reservation bot. Configure in the Vonage dashboard as:
 *   POST {APP_BASE_URL}/api/whatsapp/webhook?token={WEBHOOK_SECRET}
 *
 * Always answers 200 (except auth failures) so Vonage doesn't retry storms;
 * errors are reported to the user in-chat instead.
 */

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/** Extracts sender phone + text from the Vonage inbound payload (both shapes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInbound(body: any): { telefono: string; texto: string } | null {
  const telefono =
    typeof body?.from === "string" ? body.from : body?.from?.number;
  const texto =
    typeof body?.text === "string" ? body.text : body?.message?.content?.text;
  if (!telefono || typeof texto !== "string") return null;
  return { telefono: String(telefono).replace(/\D/g, ""), texto };
}

function buildContexto(supabase: SupabaseAdmin, telefono: string): BotContexto {
  return {
    async listarSalas() {
      const { data } = await supabase
        .from("salas_escape")
        .select("id, nombre")
        .eq("activa", true)
        .order("created_at", { ascending: true });
      return data ?? [];
    },

    async turnosDisponibles(salaId: string, fecha: string) {
      const { data: config } = await supabase
        .from("escape_config")
        .select("hora_inicio_reservas, hora_fin_reservas, duracion_bloque_min")
        .eq("id", 1)
        .single();
      if (!config) return [];
      const { data: reservas } = await supabase
        .from("escape_reservas")
        .select("sala_id, fecha, hora_inicio, estado")
        .eq("sala_id", salaId)
        .eq("fecha", fecha);
      return generarTurnosDisponibles({
        fecha,
        sala_id: salaId,
        horaInicio: config.hora_inicio_reservas,
        horaFin: config.hora_fin_reservas,
        duracionBloqueMin: config.duracion_bloque_min,
        reservasExistentes: (reservas ?? []) as ReservaExistente[],
      });
    },

    async precioPorPersona(cantidad: number) {
      const { data } = await supabase
        .from("escape_precios_persona")
        .select("precio_por_persona")
        .is("sala_id", null)
        .eq("cantidad", cantidad)
        .single();
      return data?.precio_por_persona ?? null;
    },

    async senaMinima() {
      const { data } = await supabase
        .from("escape_config")
        .select("sena_minima")
        .eq("id", 1)
        .single();
      return data?.sena_minima ?? 0;
    },

    async crearReserva(params: CrearReservaBotParams): Promise<CrearReservaBotResult> {
      // Re-validate the slot right before inserting — it may have been taken
      // while the user was chatting.
      const { data: config } = await supabase
        .from("escape_config")
        .select("hora_inicio_reservas, hora_fin_reservas, duracion_bloque_min")
        .eq("id", 1)
        .single();
      if (!config) return { ok: false, error: "Configuración no encontrada" };

      const { data: reservas } = await supabase
        .from("escape_reservas")
        .select("sala_id, fecha, hora_inicio, estado")
        .eq("sala_id", params.sala_id)
        .eq("fecha", params.fecha);

      try {
        validarTurnoPersonalizado({
          fecha: params.fecha,
          sala_id: params.sala_id,
          horaInicio: params.hora_inicio,
          horaInicioReservas: config.hora_inicio_reservas,
          horaFinReservas: config.hora_fin_reservas,
          duracionBloqueMin: config.duracion_bloque_min,
          reservasExistentes: (reservas ?? []) as ReservaExistente[],
        });
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "El turno ya no está disponible",
        };
      }

      // Find-or-create the contacto by phone.
      const telefonoE164 = `+${telefono}`;
      const { data: contactoExistente } = await supabase
        .from("escape_contactos")
        .select("id")
        .eq("telefono", telefonoE164)
        .maybeSingle();

      let contactoId = contactoExistente?.id;
      if (!contactoId) {
        const { data: nuevo, error: contactoError } = await supabase
          .from("escape_contactos")
          .insert({ nombre: params.nombre, telefono: telefonoE164, email: null })
          .select("id")
          .single();
        if (contactoError || !nuevo) {
          return { ok: false, error: "No se pudo registrar el contacto" };
        }
        contactoId = nuevo.id;
      }

      const { data: reserva, error: reservaError } = await supabase
        .from("escape_reservas")
        .insert({
          sala_id: params.sala_id,
          contacto_id: contactoId,
          fecha: params.fecha,
          hora_inicio: params.hora_inicio,
          cantidad_personas: params.cantidad_personas,
          modo_cobro: "por_persona",
          precio_total: params.precio_total,
          estado: "pendiente_sena",
          origen: "whatsapp",
          sena_monto: params.sena,
          notas: `Reserva por WhatsApp a nombre de ${params.nombre}`,
        })
        .select("id")
        .single();

      if (reservaError || !reserva) {
        return { ok: false, error: "No se pudo crear la reserva" };
      }

      const [y, m, d] = params.fecha.split("-");
      const link = await crearLinkPagoSena({
        reservaId: reserva.id,
        titulo: `Seña Escape Room — ${d}/${m}/${y} ${params.hora_inicio} hs`,
        monto: params.sena,
      });

      if (!link.ok) {
        // Without a payment link the pending reservation would block the slot
        // forever — roll it back and let the user retry.
        await supabase.from("escape_reservas").delete().eq("id", reserva.id);
        return { ok: false, error: "No se pudo generar el link de pago. Intentá de nuevo." };
      }

      await supabase
        .from("escape_reservas")
        .update({ mp_preference_id: link.preferenceId })
        .eq("id", reserva.id);

      return { ok: true, reservaId: reserva.id, linkPago: link.initPoint };
    },

    async cancelarReserva(reservaId: string) {
      await supabase
        .from("escape_reservas")
        .update({ estado: "cancelada" })
        .eq("id", reservaId)
        .eq("estado", "pendiente_sena");
    },
  };
}

export async function POST(request: NextRequest) {
  if (!authorizeWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inbound = parseInbound(body);
  if (!inbound) {
    // Status callbacks and non-text messages land here — acknowledge and skip.
    return NextResponse.json({ ok: true, skipped: true });
  }

  const supabase = createAdminClient();
  const { telefono, texto } = inbound;

  const { data: conversacion } = await supabase
    .from("whatsapp_conversaciones")
    .select("id, estado, datos")
    .eq("telefono", telefono)
    .maybeSingle();

  const estado = (conversacion?.estado ?? "inicio") as EstadoConversacion;
  const datos = (conversacion?.datos ?? {}) as DatosConversacion;

  const resultado = await procesarMensaje(
    estado,
    datos,
    texto,
    telefono,
    buildContexto(supabase, telefono)
  );

  if (conversacion) {
    await supabase
      .from("whatsapp_conversaciones")
      .update({
        estado: resultado.estado,
        datos: resultado.datos,
        reserva_id: resultado.datos.reserva_id ?? null,
      })
      .eq("id", conversacion.id);
  } else {
    await supabase.from("whatsapp_conversaciones").insert({
      telefono,
      estado: resultado.estado,
      datos: resultado.datos,
      reserva_id: resultado.datos.reserva_id ?? null,
    });
  }

  const envio = await enviarWhatsApp(`+${telefono}`, resultado.respuesta);
  if (!envio.ok) {
    // Surfaced two ways: Vercel's Runtime Logs (console.error) and, since
    // those logs truncate long lines in the dashboard, also persisted in
    // full on the conversation row so it can be read without truncation
    // from Supabase's Table Editor.
    console.error("[whatsapp/webhook] Falló el envío de la respuesta:", envio.error);
    await supabase
      .from("whatsapp_conversaciones")
      .update({ datos: { ...resultado.datos, _ultimo_error_envio: envio.error } })
      .eq("telefono", telefono);
  }

  return NextResponse.json({ ok: true, respuestaEnviada: envio.ok, error: envio.ok ? undefined : envio.error });
}
