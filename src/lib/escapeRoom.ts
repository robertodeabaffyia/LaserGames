/**
 * Escape Room pricing and slot-scheduling logic shared by the reservation
 * form (live preview), the turnos-disponibles endpoint, and the reservas
 * API (persistence) — all MUST go through these functions so the price/slot
 * the user sees is exactly what gets validated and saved.
 *
 * Times are handled as plain "HH:MM" strings and integer minutes-since-
 * midnight, never as Date objects — this sidesteps the UTC-offset bugs
 * `src/lib/fecha.ts` works around elsewhere in the app.
 */

export type ModoCobro = "por_persona" | "sala_completa";
export type EstadoReserva = "reservada" | "completada" | "cancelada";

export const ESCAPE_PRECIO_MIN_CANTIDAD = 2;
export const ESCAPE_PRECIO_MAX_CANTIDAD = 10;
export const ESCAPE_DURACION_BLOQUE_MIN_MINUTOS = 60;

export interface CalcularPrecioReservaParams {
  modo_cobro: ModoCobro;
  cantidad_personas: number;
  /** Per-person price keyed by group size (2..10), from escape_precios_persona. */
  preciosPorPersona: Partial<Record<number, number>>;
  precioSalaCompleta: number;
}

/**
 * 'sala_completa' → flat precioSalaCompleta, regardless of cantidad_personas.
 * 'por_persona'   → cantidad_personas * precio for that exact group size.
 * Throws if cantidad_personas is out of the 2..10 range, or if no price is
 * configured for that exact cantidad, when modo_cobro is 'por_persona'.
 */
export function calcularPrecioReserva(params: CalcularPrecioReservaParams): number {
  const { modo_cobro, cantidad_personas, preciosPorPersona, precioSalaCompleta } = params;

  if (modo_cobro === "sala_completa") {
    return precioSalaCompleta;
  }

  if (
    !Number.isInteger(cantidad_personas) ||
    cantidad_personas < ESCAPE_PRECIO_MIN_CANTIDAD ||
    cantidad_personas > ESCAPE_PRECIO_MAX_CANTIDAD
  ) {
    throw new Error(
      `cantidad_personas debe ser un entero entre ${ESCAPE_PRECIO_MIN_CANTIDAD} y ${ESCAPE_PRECIO_MAX_CANTIDAD} para el modo por_persona`
    );
  }

  const precioPorPersona = preciosPorPersona[cantidad_personas];
  if (precioPorPersona === undefined) {
    throw new Error(`No hay precio configurado para ${cantidad_personas} personas`);
  }

  return cantidad_personas * precioPorPersona;
}

/** True if horaFin is strictly later than horaInicio ("HH:MM" or "HH:MM:SS" strings). */
export function horarioEsValido(horaInicio: string, horaFin: string): boolean {
  return horaToMinutos(horaFin) > horaToMinutos(horaInicio);
}

function horaToMinutos(hora: string): number {
  const [h, m] = hora.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minutosToHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface ReservaExistente {
  sala_id: string;
  fecha: string; // "YYYY-MM-DD"
  hora_inicio: string; // "HH:MM" or "HH:MM:SS"
  estado: EstadoReserva;
}

export interface GenerarTurnosDisponiblesParams {
  fecha: string;
  sala_id: string;
  /** "HH:MM" — from escape_config.hora_inicio_reservas */
  horaInicio: string;
  /** "HH:MM" — from escape_config.hora_fin_reservas */
  horaFin: string;
  duracionBloqueMin: number;
  /**
   * Existing reservations to check against. Safe to pass reservations for
   * other rooms/dates or other statuses too — they're filtered internally
   * to this sala_id + fecha and to non-cancelled bookings.
   */
  reservasExistentes: ReservaExistente[];
}

/** Existing reservations' start times (minutes-since-midnight) for this sala_id + fecha, cancelled ones excluded. */
function ocupadosMinutos(
  fecha: string,
  sala_id: string,
  reservasExistentes: ReservaExistente[]
): number[] {
  return reservasExistentes
    .filter((r) => r.sala_id === sala_id && r.fecha === fecha && r.estado !== "cancelada")
    .map((r) => horaToMinutos(r.hora_inicio));
}

/**
 * True if a duracionBloqueMin-long slot starting at `inicio` (minutes) would
 * overlap any occupied slot of the same length. Since every booking occupies
 * exactly duracionBloqueMin, two same-length intervals overlap iff their
 * start times are closer together than the block duration.
 */
function seSuperpone(inicio: number, duracionBloqueMin: number, ocupados: number[]): boolean {
  return ocupados.some((o) => Math.abs(o - inicio) < duracionBloqueMin);
}

/**
 * Returns the available slot start times ("HH:MM") for a room/date: stepping
 * by duracionBloqueMin from horaInicio up to horaFin (a slot must fully fit
 * before horaFin), excluding any slot within duracionBloqueMin of an existing
 * non-cancelled reservation in that same room and date.
 */
export function generarTurnosDisponibles(params: GenerarTurnosDisponiblesParams): string[] {
  const { fecha, sala_id, horaInicio, horaFin, duracionBloqueMin, reservasExistentes } = params;

  if (duracionBloqueMin <= 0) return [];

  const inicioMin = horaToMinutos(horaInicio);
  const finMin = horaToMinutos(horaFin);
  const ocupados = ocupadosMinutos(fecha, sala_id, reservasExistentes);

  const turnos: string[] = [];
  for (let t = inicioMin; t + duracionBloqueMin <= finMin; t += duracionBloqueMin) {
    if (!seSuperpone(t, duracionBloqueMin, ocupados)) turnos.push(minutosToHora(t));
  }
  return turnos;
}

export interface ValidarTurnoPersonalizadoParams {
  fecha: string;
  sala_id: string;
  /** Candidate start time, "HH:MM" or "HH:MM:SS" — may be off the suggested grid. */
  horaInicio: string;
  /** "HH:MM" — from escape_config.hora_inicio_reservas */
  horaInicioReservas: string;
  /** "HH:MM" — from escape_config.hora_fin_reservas */
  horaFinReservas: string;
  duracionBloqueMin: number;
  reservasExistentes: ReservaExistente[];
}

/**
 * Validates an arbitrary (not necessarily grid-aligned) custom start time:
 * the [horaInicio, horaInicio + duracionBloqueMin) slot must fit entirely
 * within [horaInicioReservas, horaFinReservas) and must not overlap any
 * existing non-cancelled reservation in that same room/date. Throws with a
 * user-facing message when invalid; returns void when the slot is OK.
 */
export function validarTurnoPersonalizado(params: ValidarTurnoPersonalizadoParams): void {
  const {
    fecha,
    sala_id,
    horaInicio,
    horaInicioReservas,
    horaFinReservas,
    duracionBloqueMin,
    reservasExistentes,
  } = params;

  const inicio = horaToMinutos(horaInicio);
  const fin = inicio + duracionBloqueMin;
  const rangoInicio = horaToMinutos(horaInicioReservas);
  const rangoFin = horaToMinutos(horaFinReservas);

  if (inicio < rangoInicio || fin > rangoFin) {
    throw new Error(
      `El horario debe estar entre ${horaInicioReservas.slice(0, 5)} y ${horaFinReservas.slice(0, 5)}`
    );
  }

  const ocupados = ocupadosMinutos(fecha, sala_id, reservasExistentes);
  if (seSuperpone(inicio, duracionBloqueMin, ocupados)) {
    throw new Error("Este horario se superpone con otra reserva existente en esa sala");
  }
}
