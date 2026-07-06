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
import {
  procesarMensajeCumple,
  preguntarPaquetes,
  type CumpleContexto,
  type CrearEventoBotParams,
  type CrearEventoBotResult,
  type DatosCumple,
  type EstadoCumple,
} from "@/lib/cumpleanosWhatsappBot";
import { MENU_PRINCIPAL, parseFlujo, esCancelar, type Flujo } from "@/lib/whatsappBotMenu";

/**
 * Vonage Messages API inbound webhook — the entry point of the WhatsApp
 * reservation bot. Configure in the Vonage dashboard as:
 *   POST {APP_BASE_URL}/api/whatsapp/webhook?token={WEBHOOK_SECRET}
 *
 * A top-level menu chooses the flow (cumpleaños vs escape room); the picked
 * flujo is stored in the conversation `datos` and each subsequent message is
 * dispatched to that flow's pure state machine. "cancelar" frees any pending
 * booking and returns to the main menu.
 *
 * Always answers 200 (except auth failures) so Vonage doesn't retry storms;
 * errors are reported to the user in-chat instead.
 */

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/** datos as stored in the conversation: a flow's own fields plus the chosen flujo. */
type DatosBot = (DatosConversacion & DatosCumple) & { flujo?: Flujo };

interface Resultado {
  respuesta: string;
  estado: string;
  datos: DatosBot;
}

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

// ── Escape Room context ───────────────────────────────────────────────────────

function buildEscapeContexto(supabase: SupabaseAdmin, telefono: string): BotContexto {
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

      const contactoId = await findOrCreateContacto(
        supabase,
        "escape_contactos",
        telefono,
        params.nombre
      );
      if (!contactoId) return { ok: false, error: "No se pudo registrar el contacto" };

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

// ── Cumpleaños context ────────────────────────────────────────────────────────

function buildCumpleContexto(supabase: SupabaseAdmin, telefono: string): CumpleContexto {
  return {
    async listarPaquetes() {
      const { data } = await supabase
        .from("paquetes")
        .select(
          "id, nombre, precio, cantidad_ninos_incluidos, cantidad_adultos_incluidos, precio_nino_adicional, precio_adulto_adicional, max_invitados"
        )
        .eq("es_activo", true)
        .order("orden", { ascending: true });
      return data ?? [];
    },

    async senaMinima() {
      const { data } = await supabase
        .from("configuraciones")
        .select("monto_seña")
        .limit(1)
        .maybeSingle();
      return (data as { monto_seña?: number } | null)?.monto_seña ?? 0;
    },

    async crearEvento(params: CrearEventoBotParams): Promise<CrearEventoBotResult> {
      const { data: paquete } = await supabase
        .from("paquetes")
        .select("duracion_horas, duracion_minutos")
        .eq("id", params.paquete_id)
        .single();
      if (!paquete) return { ok: false, error: "El paquete ya no está disponible" };

      const clienteId = await findOrCreateContacto(
        supabase,
        "clientes",
        telefono,
        params.nombre_contacto
      );
      if (!clienteId) return { ok: false, error: "No se pudo registrar el contacto" };

      const { data: evento, error: eventoError } = await supabase
        .from("eventos")
        .insert({
          cliente_id: clienteId,
          paquete_id: params.paquete_id,
          fecha_evento: params.fecha_evento,
          nombre_festejado: params.nombre_festejado,
          num_invitados: params.cantidad_ninos + params.cantidad_adultos,
          cantidad_ninos_totales: params.cantidad_ninos,
          cantidad_adultos_totales: params.cantidad_adultos,
          duracion_horas: paquete.duracion_horas,
          duracion_minutos: paquete.duracion_minutos,
          precio_total: params.precio_total,
          estado: "pendiente",
          origen: "whatsapp",
          sena_monto: params.sena,
          notas: `Reserva por WhatsApp a nombre de ${params.nombre_contacto}`,
        })
        .select("id")
        .single();

      if (eventoError || !evento) {
        return { ok: false, error: "No se pudo crear la reserva" };
      }

      const link = await crearLinkPagoSena({
        reservaId: evento.id,
        titulo: `Seña Cumpleaños — ${params.nombre_festejado}`,
        monto: params.sena,
      });

      if (!link.ok) {
        // No payment link → roll the event back so it isn't left dangling.
        await supabase.from("eventos").delete().eq("id", evento.id);
        return { ok: false, error: "No se pudo generar el link de pago. Intentá de nuevo." };
      }

      await supabase
        .from("eventos")
        .update({ mp_preference_id: link.preferenceId })
        .eq("id", evento.id);

      return { ok: true, eventoId: evento.id, linkPago: link.initPoint };
    },

    async cancelarEvento(eventoId: string) {
      await supabase
        .from("eventos")
        .update({ estado: "cancelado" })
        .eq("id", eventoId)
        .eq("estado", "pendiente");
    },
  };
}

/** Find-or-create a contact by phone in `clientes` or `escape_contactos`. Returns its id, or null on failure. */
async function findOrCreateContacto(
  supabase: SupabaseAdmin,
  tabla: "clientes" | "escape_contactos",
  telefono: string,
  nombre: string
): Promise<string | null> {
  const telefonoE164 = `+${telefono}`;
  const { data: existente } = await supabase
    .from(tabla)
    .select("id")
    .eq("telefono", telefonoE164)
    .maybeSingle();
  if (existente?.id) return existente.id;

  const { data: nuevo } = await supabase
    .from(tabla)
    .insert({ nombre, telefono: telefonoE164, email: null })
    .select("id")
    .single();
  return nuevo?.id ?? null;
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

async function despachar(
  supabase: SupabaseAdmin,
  telefono: string,
  estado: string,
  datos: DatosBot,
  texto: string
): Promise<Resultado> {
  const escapeCtx = buildEscapeContexto(supabase, telefono);
  const cumpleCtx = buildCumpleContexto(supabase, telefono);
  const flujo = datos.flujo;

  // "cancelar" always frees any pending booking and returns to the main menu.
  if (esCancelar(texto)) {
    if (flujo === "escape" && datos.reserva_id) {
      await escapeCtx.cancelarReserva(datos.reserva_id);
    } else if (flujo === "cumpleanos" && datos.evento_id) {
      await cumpleCtx.cancelarEvento(datos.evento_id);
    }
    return { respuesta: `Listo, volvamos al inicio.\n\n${MENU_PRINCIPAL}`, estado: "menu", datos: {} };
  }

  // First contact (or fresh conversation): show the main menu.
  if (estado === "inicio") {
    return { respuesta: MENU_PRINCIPAL, estado: "menu", datos: {} };
  }

  // At the main menu: resolve which flow the user picked.
  if (estado === "menu") {
    const elegido = parseFlujo(texto);
    if (!elegido) {
      return {
        respuesta: `No entendí la opción.\n\n${MENU_PRINCIPAL}`,
        estado: "menu",
        datos: {},
      };
    }
    if (elegido === "escape") {
      const r = await procesarMensaje("inicio", {}, texto, telefono, escapeCtx);
      return { ...r, datos: { ...r.datos, flujo: "escape" } };
    }
    const r = await preguntarPaquetes(cumpleCtx, "¡Genial, un cumpleaños! 🎉");
    return { ...r, datos: { ...r.datos, flujo: "cumpleanos" } };
  }

  // Mid-flow: delegate to the active flow's state machine.
  if (flujo === "escape") {
    const r = await procesarMensaje(estado as EstadoConversacion, datos, texto, telefono, escapeCtx);
    return { ...r, datos: { ...r.datos, flujo: "escape" } };
  }
  if (flujo === "cumpleanos") {
    const r = await procesarMensajeCumple(estado as EstadoCumple, datos, texto, telefono, cumpleCtx);
    return { ...r, datos: { ...r.datos, flujo: "cumpleanos" } };
  }

  // No active flujo but not at the menu (shouldn't happen) — recover gracefully.
  return { respuesta: MENU_PRINCIPAL, estado: "menu", datos: {} };
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

  const estado = conversacion?.estado ?? "inicio";
  const datos = (conversacion?.datos ?? {}) as DatosBot;

  const resultado = await despachar(supabase, telefono, estado, datos, texto);

  // whatsapp_conversaciones.reserva_id FKs escape_reservas, so only set it for
  // the escape flow; the cumpleaños evento id lives in datos.evento_id.
  const reservaId =
    resultado.datos.flujo === "escape" ? resultado.datos.reserva_id ?? null : null;

  if (conversacion) {
    await supabase
      .from("whatsapp_conversaciones")
      .update({ estado: resultado.estado, datos: resultado.datos, reserva_id: reservaId })
      .eq("id", conversacion.id);
  } else {
    await supabase.from("whatsapp_conversaciones").insert({
      telefono,
      estado: resultado.estado,
      datos: resultado.datos,
      reserva_id: reservaId,
    });
  }

  // No leading "+": confirmed against the Messages API Sandbox that it
  // expects raw digits for "to" (same as "from"), matching how inbound
  // numbers already arrive from parseInbound.
  const envio = await enviarWhatsApp(telefono, resultado.respuesta);
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
