/**
 * Guided-menu WhatsApp bot for birthday event (cumpleaños) reservations.
 *
 * Mirrors the pure-function + injected-context design of
 * `escapeWhatsappBot.ts`: `procesarMensajeCumple` receives the current state
 * + collected data + the incoming text and returns the reply, next state and
 * updated data. All I/O (packages, seña, creating the event and the Mercado
 * Pago link) goes through the injected `CumpleContexto`, so the flow is fully
 * unit-testable and the webhook stays a thin adapter.
 *
 * Flow: paquete → fecha → hora → festejado → ninos → adultos → nombre
 *       → confirmar → esperando_pago (MP webhook confirms + resets).
 * "cancelar" is handled by the webhook dispatcher (frees any pending event).
 */

import { parseFecha } from "@/lib/fecha";
import { calcularPrecioTotal, combineFechaHora } from "@/lib/eventos";

export type EstadoCumple =
  | "paquete"
  | "fecha"
  | "hora"
  | "festejado"
  | "ninos"
  | "adultos"
  | "nombre"
  | "confirmar"
  | "esperando_pago";

export interface PaqueteBot {
  id: string;
  nombre: string;
  precio: number;
  cantidad_ninos_incluidos: number;
  cantidad_adultos_incluidos: number;
  precio_nino_adicional: number;
  precio_adulto_adicional: number;
  max_invitados: number;
}

export interface DatosCumple {
  paquetes?: { id: string; nombre: string }[]; // last offered list, to resolve a numeric pick
  paquete_id?: string;
  paquete_nombre?: string;
  precio_paquete?: number;
  ninos_incluidos?: number;
  adultos_incluidos?: number;
  precio_nino_adicional?: number;
  precio_adulto_adicional?: number;
  fecha?: string; // "YYYY-MM-DD"
  hora?: string; // "HH:MM"
  festejado?: string;
  cantidad_ninos?: number;
  cantidad_adultos?: number;
  precio_total?: number;
  sena?: number;
  nombre?: string;
  evento_id?: string;
}

export interface CrearEventoBotParams {
  paquete_id: string;
  fecha_evento: string; // ISO timestamptz
  nombre_festejado: string;
  cantidad_ninos: number;
  cantidad_adultos: number;
  nombre_contacto: string;
  telefono: string;
  precio_total: number;
  sena: number;
}

export type CrearEventoBotResult =
  | { ok: true; eventoId: string; linkPago: string }
  | { ok: false; error: string };

export interface CumpleContexto {
  listarPaquetes(): Promise<PaqueteBot[]>;
  senaMinima(): Promise<number>;
  crearEvento(params: CrearEventoBotParams): Promise<CrearEventoBotResult>;
  cancelarEvento(eventoId: string): Promise<void>;
}

export interface ResultadoCumple {
  respuesta: string;
  estado: EstadoCumple;
  datos: DatosCumple;
}

const FORMATO_FECHA =
  "Indicá la fecha del cumple (formato dd/mm/aaaa, ej. 15/08/2026).";
const FORMATO_HORA = "¿A qué hora arranca? (formato hh:mm, ej. 16:30).";

function formatMonto(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

function parseSeleccion(texto: string, max: number): number | null {
  const n = Number(texto.trim());
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n - 1;
}

function parseEntero(texto: string): number | null {
  const n = Number(texto.trim());
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

const HORA_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function fechaLocalHoy(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fechaToISO(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Renders the package menu, or a "come back later" message when there are none. */
export async function preguntarPaquetes(
  ctx: CumpleContexto,
  prefijo: string
): Promise<ResultadoCumple> {
  const paquetes = await ctx.listarPaquetes();
  if (paquetes.length === 0) {
    return {
      respuesta: `${prefijo}\n\nPor el momento no hay paquetes disponibles. ¡Escribinos más tarde!`,
      estado: "paquete",
      datos: {},
    };
  }
  const lista = paquetes
    .map((p, i) => `${i + 1}. ${p.nombre} — ${formatMonto(p.precio)}`)
    .join("\n");
  return {
    respuesta: `${prefijo}\n\n¿Qué paquete querés reservar? Respondé con el número:\n${lista}`,
    estado: "paquete",
    datos: { paquetes: paquetes.map((p) => ({ id: p.id, nombre: p.nombre })) },
  };
}

export async function procesarMensajeCumple(
  estado: EstadoCumple,
  datos: DatosCumple,
  texto: string,
  telefono: string,
  ctx: CumpleContexto
): Promise<ResultadoCumple> {
  switch (estado) {
    case "paquete": {
      const paquetes = await ctx.listarPaquetes();
      const idx = parseSeleccion(texto, paquetes.length);
      if (idx === null) {
        const lista = paquetes
          .map((p, i) => `${i + 1}. ${p.nombre} — ${formatMonto(p.precio)}`)
          .join("\n");
        return {
          respuesta: `No entendí la opción. Respondé con el número del paquete:\n${lista}`,
          estado: "paquete",
          datos,
        };
      }
      const p = paquetes[idx];
      return {
        respuesta: `Elegiste *${p.nombre}*. ${FORMATO_FECHA}`,
        estado: "fecha",
        datos: {
          paquete_id: p.id,
          paquete_nombre: p.nombre,
          precio_paquete: p.precio,
          ninos_incluidos: p.cantidad_ninos_incluidos,
          adultos_incluidos: p.cantidad_adultos_incluidos,
          precio_nino_adicional: p.precio_nino_adicional,
          precio_adulto_adicional: p.precio_adulto_adicional,
        },
      };
    }

    case "fecha": {
      const fecha = parseFecha(texto.trim());
      if (!fecha) {
        return { respuesta: `No pude leer esa fecha. ${FORMATO_FECHA}`, estado: "fecha", datos };
      }
      if (fecha < fechaLocalHoy()) {
        return { respuesta: `Esa fecha ya pasó. ${FORMATO_FECHA}`, estado: "fecha", datos };
      }
      return {
        respuesta: FORMATO_HORA,
        estado: "hora",
        datos: { ...datos, fecha: fechaToISO(fecha) },
      };
    }

    case "hora": {
      const hora = texto.trim();
      if (!HORA_RE.test(hora)) {
        return { respuesta: `No pude leer esa hora. ${FORMATO_HORA}`, estado: "hora", datos };
      }
      return {
        respuesta: "¿Cómo se llama el/la festejado/a?",
        estado: "festejado",
        datos: { ...datos, hora },
      };
    }

    case "festejado": {
      const festejado = texto.trim();
      if (festejado.length < 2) {
        return { respuesta: "¿Me pasás un nombre válido para el/la festejado/a?", estado: "festejado", datos };
      }
      return {
        respuesta: `¿Cuántos niños van a asistir? (incluidos en el paquete: ${datos.ninos_incluidos ?? 0})`,
        estado: "ninos",
        datos: { ...datos, festejado },
      };
    }

    case "ninos": {
      const ninos = parseEntero(texto);
      if (ninos === null) {
        return { respuesta: "Necesito un número de niños válido (0 o más). ¿Cuántos niños van a asistir?", estado: "ninos", datos };
      }
      return {
        respuesta: `¿Cuántos adultos van a asistir? (incluidos en el paquete: ${datos.adultos_incluidos ?? 0})`,
        estado: "adultos",
        datos: { ...datos, cantidad_ninos: ninos },
      };
    }

    case "adultos": {
      const adultos = parseEntero(texto);
      if (adultos === null) {
        return { respuesta: "Necesito un número de adultos válido (0 o más). ¿Cuántos adultos van a asistir?", estado: "adultos", datos };
      }
      return {
        respuesta: "¿A nombre de quién hacemos la reserva?",
        estado: "nombre",
        datos: { ...datos, cantidad_adultos: adultos },
      };
    }

    case "nombre": {
      const nombre = texto.trim();
      if (nombre.length < 2) {
        return { respuesta: "¿Me pasás un nombre válido para la reserva?", estado: "nombre", datos };
      }

      const precioTotal = calcularPrecioTotal({
        precioPaquete: datos.precio_paquete ?? 0,
        cantidadNinosTotales: datos.cantidad_ninos ?? 0,
        ninosIncluidos: datos.ninos_incluidos ?? 0,
        precioNinoExtra: datos.precio_nino_adicional ?? 0,
        cantidadAdultosTotales: datos.cantidad_adultos ?? 0,
        adultosIncluidos: datos.adultos_incluidos ?? 0,
        precioAdulto: datos.precio_adulto_adicional ?? 0,
        descuento: 0,
      });

      const senaConfig = await ctx.senaMinima();
      const sena = Math.min(senaConfig, precioTotal || senaConfig);

      const [y, m, d] = (datos.fecha ?? "").split("-");
      const resumen =
        "Revisá tu reserva de cumpleaños:\n" +
        `🎉 Paquete: ${datos.paquete_nombre}\n` +
        `📅 Fecha: ${d}/${m}/${y} a las ${datos.hora} hs\n` +
        `🎂 Festejado/a: ${datos.festejado}\n` +
        `👦 Niños: ${datos.cantidad_ninos}   🧑 Adultos: ${datos.cantidad_adultos}\n` +
        `💰 Precio total: ${formatMonto(precioTotal)}\n` +
        `💵 Seña para confirmar: ${formatMonto(sena)}\n\n` +
        "1. Confirmar\n2. Cancelar";
      return {
        respuesta: resumen,
        estado: "confirmar",
        datos: { ...datos, nombre, precio_total: precioTotal, sena },
      };
    }

    case "confirmar": {
      const opcion = texto.trim();
      if (opcion === "2") {
        return preguntarPaquetes(ctx, "Reserva descartada. Empecemos de nuevo cuando quieras. 👍");
      }
      if (opcion !== "1") {
        return { respuesta: "Respondé *1* para confirmar o *2* para cancelar.", estado: "confirmar", datos };
      }

      const resultado = await ctx.crearEvento({
        paquete_id: datos.paquete_id!,
        fecha_evento: combineFechaHora(datos.fecha!, datos.hora!),
        nombre_festejado: datos.festejado!,
        cantidad_ninos: datos.cantidad_ninos!,
        cantidad_adultos: datos.cantidad_adultos!,
        nombre_contacto: datos.nombre!,
        telefono,
        precio_total: datos.precio_total!,
        sena: datos.sena!,
      });

      if (!resultado.ok) {
        return {
          respuesta: `No pude crear la reserva: ${resultado.error}\n${FORMATO_FECHA}`,
          estado: "fecha",
          datos: {
            paquete_id: datos.paquete_id,
            paquete_nombre: datos.paquete_nombre,
            precio_paquete: datos.precio_paquete,
            ninos_incluidos: datos.ninos_incluidos,
            adultos_incluidos: datos.adultos_incluidos,
            precio_nino_adicional: datos.precio_nino_adicional,
            precio_adulto_adicional: datos.precio_adulto_adicional,
          },
        };
      }

      return {
        respuesta:
          `¡Casi listo, ${datos.nombre}! Para confirmar tu reserva pagá la seña de ${formatMonto(datos.sena ?? 0)} acá:\n` +
          `${resultado.linkPago}\n\n` +
          "Apenas se acredite el pago te llega la confirmación por este mismo chat. " +
          "Si querés cancelar la reserva pendiente, escribí *cancelar*.",
        estado: "esperando_pago",
        datos: { ...datos, evento_id: resultado.eventoId },
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
