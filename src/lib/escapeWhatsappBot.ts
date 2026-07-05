/**
 * Guided-menu WhatsApp bot for Escape Room reservations.
 *
 * Pure conversation state machine: `procesarMensaje` receives the current
 * state + collected data + the incoming text and returns the reply, the next
 * state and the updated data. All I/O (salas, turnos, precios, creating the
 * reservation and the Mercado Pago link) goes through the injected
 * `BotContexto`, so the whole flow is unit-testable with a fake context and
 * the webhook route stays a thin adapter.
 *
 * Flow: inicio → sala → fecha → turno → personas → nombre → confirmar
 *       → esperando_pago (MP webhook confirms and resets the conversation).
 * "cancelar" at any point resets; in esperando_pago it also cancels the
 * pending reservation so the slot is freed.
 */

import { parseFecha } from "@/lib/fecha";
import {
  ESCAPE_PRECIO_MIN_CANTIDAD,
  ESCAPE_PRECIO_MAX_CANTIDAD,
} from "@/lib/escapeRoom";

export type EstadoConversacion =
  | "inicio"
  | "sala"
  | "fecha"
  | "turno"
  | "personas"
  | "nombre"
  | "confirmar"
  | "esperando_pago";

export interface DatosConversacion {
  sala_id?: string;
  sala_nombre?: string;
  fecha?: string; // "YYYY-MM-DD"
  turnos?: string[]; // last offered slots, so "turno" can resolve "2" → "19:30"
  hora_inicio?: string;
  cantidad_personas?: number;
  precio_por_persona?: number;
  precio_total?: number;
  sena?: number;
  nombre?: string;
  reserva_id?: string;
}

export interface CrearReservaBotParams {
  sala_id: string;
  fecha: string;
  hora_inicio: string;
  cantidad_personas: number;
  nombre: string;
  telefono: string;
  precio_total: number;
  sena: number;
}

export type CrearReservaBotResult =
  | { ok: true; reservaId: string; linkPago: string }
  | { ok: false; error: string };

export interface BotContexto {
  listarSalas(): Promise<{ id: string; nombre: string }[]>;
  turnosDisponibles(salaId: string, fecha: string): Promise<string[]>;
  /** Per-person price for that exact group size, or null when not configured. */
  precioPorPersona(cantidad: number): Promise<number | null>;
  senaMinima(): Promise<number>;
  crearReserva(params: CrearReservaBotParams): Promise<CrearReservaBotResult>;
  cancelarReserva(reservaId: string): Promise<void>;
}

export interface BotResultado {
  respuesta: string;
  estado: EstadoConversacion;
  datos: DatosConversacion;
}

const SALUDO =
  "¡Hola! Soy el asistente de reservas de Laser Games Escape Rooms. 🗝️\n" +
  "En cualquier momento podés escribir *cancelar* para empezar de nuevo.";

const FORMATO_FECHA = "Indicá la fecha que querés reservar (formato dd/mm/aaaa, ej. 15/08/2026).";

function formatMonto(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

function esCancelar(texto: string): boolean {
  return texto.trim().toLowerCase() === "cancelar";
}

/** Parses a 1-based menu selection; returns the 0-based index or null. */
function parseSeleccion(texto: string, max: number): number | null {
  const n = Number(texto.trim());
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n - 1;
}

function fechaLocalHoy(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fechaToISO(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

async function preguntarSalas(ctx: BotContexto, prefijo: string): Promise<BotResultado> {
  const salas = await ctx.listarSalas();
  if (salas.length === 0) {
    return {
      respuesta: `${prefijo}\n\nPor el momento no hay salas disponibles. ¡Escribinos más tarde!`,
      estado: "inicio",
      datos: {},
    };
  }
  const lista = salas.map((s, i) => `${i + 1}. ${s.nombre}`).join("\n");
  return {
    respuesta: `${prefijo}\n\n¿Qué sala querés reservar? Respondé con el número:\n${lista}`,
    estado: "sala",
    datos: {},
  };
}

export async function procesarMensaje(
  estado: EstadoConversacion,
  datos: DatosConversacion,
  texto: string,
  telefono: string,
  ctx: BotContexto
): Promise<BotResultado> {
  // "cancelar" resets from anywhere; in esperando_pago it also frees the slot.
  if (esCancelar(texto)) {
    if (estado === "esperando_pago" && datos.reserva_id) {
      await ctx.cancelarReserva(datos.reserva_id);
      return preguntarSalas(ctx, "Tu reserva pendiente fue cancelada. Empecemos de nuevo cuando quieras. 👍");
    }
    return preguntarSalas(ctx, "Listo, empezamos de nuevo. 👍");
  }

  switch (estado) {
    case "inicio":
      return preguntarSalas(ctx, SALUDO);

    case "sala": {
      const salas = await ctx.listarSalas();
      const idx = parseSeleccion(texto, salas.length);
      if (idx === null) {
        const lista = salas.map((s, i) => `${i + 1}. ${s.nombre}`).join("\n");
        return {
          respuesta: `No entendí la opción. Respondé con el número de la sala:\n${lista}`,
          estado: "sala",
          datos,
        };
      }
      const sala = salas[idx];
      return {
        respuesta: `Elegiste *${sala.nombre}*. ${FORMATO_FECHA}`,
        estado: "fecha",
        datos: { sala_id: sala.id, sala_nombre: sala.nombre },
      };
    }

    case "fecha": {
      const fecha = parseFecha(texto.trim());
      if (!fecha) {
        return {
          respuesta: `No pude leer esa fecha. ${FORMATO_FECHA}`,
          estado: "fecha",
          datos,
        };
      }
      if (fecha < fechaLocalHoy()) {
        return {
          respuesta: `Esa fecha ya pasó. ${FORMATO_FECHA}`,
          estado: "fecha",
          datos,
        };
      }
      const fechaISO = fechaToISO(fecha);
      const turnos = await ctx.turnosDisponibles(datos.sala_id!, fechaISO);
      if (turnos.length === 0) {
        return {
          respuesta:
            `No quedan turnos disponibles en ${datos.sala_nombre} para ese día. 😔\n` +
            "Probá con otra fecha (dd/mm/aaaa).",
          estado: "fecha",
          datos,
        };
      }
      const lista = turnos.map((t, i) => `${i + 1}. ${t} hs`).join("\n");
      return {
        respuesta: `Turnos disponibles para ese día:\n${lista}\n\nRespondé con el número del turno.`,
        estado: "turno",
        datos: { ...datos, fecha: fechaISO, turnos },
      };
    }

    case "turno": {
      const turnos = datos.turnos ?? [];
      const idx = parseSeleccion(texto, turnos.length);
      if (idx === null) {
        const lista = turnos.map((t, i) => `${i + 1}. ${t} hs`).join("\n");
        return {
          respuesta: `No entendí la opción. Respondé con el número del turno:\n${lista}`,
          estado: "turno",
          datos,
        };
      }
      return {
        respuesta: `¿Cuántas personas van a jugar? (entre ${ESCAPE_PRECIO_MIN_CANTIDAD} y ${ESCAPE_PRECIO_MAX_CANTIDAD})`,
        estado: "personas",
        datos: { ...datos, hora_inicio: turnos[idx] },
      };
    }

    case "personas": {
      const cantidad = Number(texto.trim());
      if (
        !Number.isInteger(cantidad) ||
        cantidad < ESCAPE_PRECIO_MIN_CANTIDAD ||
        cantidad > ESCAPE_PRECIO_MAX_CANTIDAD
      ) {
        return {
          respuesta: `Necesito un número entre ${ESCAPE_PRECIO_MIN_CANTIDAD} y ${ESCAPE_PRECIO_MAX_CANTIDAD}. ¿Cuántas personas van a jugar?`,
          estado: "personas",
          datos,
        };
      }
      const precioPorPersona = await ctx.precioPorPersona(cantidad);
      if (precioPorPersona === null) {
        return {
          respuesta:
            "No tenemos precio configurado para esa cantidad de personas. " +
            `Probá con otra cantidad (${ESCAPE_PRECIO_MIN_CANTIDAD} a ${ESCAPE_PRECIO_MAX_CANTIDAD}).`,
          estado: "personas",
          datos,
        };
      }
      const precioTotal = cantidad * precioPorPersona;
      return {
        respuesta: "¿A nombre de quién hacemos la reserva?",
        estado: "nombre",
        datos: {
          ...datos,
          cantidad_personas: cantidad,
          precio_por_persona: precioPorPersona,
          precio_total: precioTotal,
        },
      };
    }

    case "nombre": {
      const nombre = texto.trim();
      if (nombre.length < 2) {
        return {
          respuesta: "¿Me pasás un nombre válido para la reserva?",
          estado: "nombre",
          datos,
        };
      }
      const senaConfig = await ctx.senaMinima();
      const sena = Math.min(senaConfig, datos.precio_total ?? senaConfig);
      const [y, m, d] = (datos.fecha ?? "").split("-");
      const resumen =
        "Revisá tu reserva:\n" +
        `🗝️ Sala: ${datos.sala_nombre}\n` +
        `📅 Fecha: ${d}/${m}/${y}\n` +
        `🕐 Hora: ${datos.hora_inicio} hs\n` +
        `👥 Personas: ${datos.cantidad_personas} × ${formatMonto(datos.precio_por_persona ?? 0)} = ${formatMonto(datos.precio_total ?? 0)}\n` +
        `💵 Seña para confirmar: ${formatMonto(sena)}\n\n` +
        "1. Confirmar\n2. Cancelar";
      return {
        respuesta: resumen,
        estado: "confirmar",
        datos: { ...datos, nombre, sena },
      };
    }

    case "confirmar": {
      const opcion = texto.trim();
      if (opcion === "2") {
        return preguntarSalas(ctx, "Reserva descartada. Empecemos de nuevo cuando quieras. 👍");
      }
      if (opcion !== "1") {
        return {
          respuesta: "Respondé *1* para confirmar o *2* para cancelar.",
          estado: "confirmar",
          datos,
        };
      }
      const resultado = await ctx.crearReserva({
        sala_id: datos.sala_id!,
        fecha: datos.fecha!,
        hora_inicio: datos.hora_inicio!,
        cantidad_personas: datos.cantidad_personas!,
        nombre: datos.nombre!,
        telefono,
        precio_total: datos.precio_total!,
        sena: datos.sena!,
      });
      if (!resultado.ok) {
        // Most likely the slot was taken while chatting — restart at fecha.
        return {
          respuesta: `No pude crear la reserva: ${resultado.error}\n${FORMATO_FECHA}`,
          estado: "fecha",
          datos: { sala_id: datos.sala_id, sala_nombre: datos.sala_nombre },
        };
      }
      return {
        respuesta:
          `¡Casi listo, ${datos.nombre}! Para confirmar tu reserva pagá la seña de ${formatMonto(datos.sena ?? 0)} acá:\n` +
          `${resultado.linkPago}\n\n` +
          "Apenas se acredite el pago te llega la confirmación por este mismo chat. " +
          "Si querés cancelar la reserva pendiente, escribí *cancelar*.",
        estado: "esperando_pago",
        datos: { ...datos, reserva_id: resultado.reservaId },
      };
    }

    case "esperando_pago":
      return {
        respuesta:
          "Tu reserva está esperando el pago de la seña. Apenas se acredite te llega la confirmación automáticamente. 🙌\n" +
          "Si querés cancelarla, escribí *cancelar*.",
        estado: "esperando_pago",
        datos,
      };
  }
}
