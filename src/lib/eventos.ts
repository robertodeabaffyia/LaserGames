export interface PrecioParams {
  precioPaquete: number;
  /** Total children attending the event */
  cantidadNinosTotales: number;
  /** Children included in the package (no extra charge) */
  ninosIncluidos: number;
  precioNinoExtra: number;
  /** Total adults attending the event */
  cantidadAdultosTotales: number;
  /** Adults included in the package (no extra charge) */
  adultosIncluidos: number;
  precioAdulto: number;
  descuento: number;
}

/**
 * Calculates the total price of an event.
 * extras = max(0, total − included)
 * precio_total = paquete + (niños_extra × precio_niño) + (adultos_extra × precio_adulto) − descuento
 * Result is clamped to >= 0.
 */
export function calcularPrecioTotal(params: PrecioParams): number {
  const ninosExtra = Math.max(0, params.cantidadNinosTotales - params.ninosIncluidos);
  const adultosExtra = Math.max(0, params.cantidadAdultosTotales - params.adultosIncluidos);
  const subtotal =
    params.precioPaquete +
    ninosExtra * params.precioNinoExtra +
    adultosExtra * params.precioAdulto;
  return Math.max(0, subtotal - params.descuento);
}

/**
 * Convert a datetime-local string ("YYYY-MM-DDTHH:MM") to a UTC ISO-8601
 * timestamp suitable for the API.
 *
 * Using `new Date(string).toISOString()` is intentional: datetime-local
 * values are treated as *local* time by the Date constructor, so the
 * resulting ISO string correctly reflects the user's intended wall-clock
 * time converted to UTC.
 *
 * Exported so the EventoForm payload-building logic can be unit-tested
 * without mounting the component.
 */
export function fechaEventoToISO(datetimeLocal: string): string {
  return new Date(datetimeLocal).toISOString();
}

/**
 * Combine a date-only string ("YYYY-MM-DD") and a time-only string ("HH:MM")
 * coming from separate <input type="date"> + <input type="time"> fields into
 * a UTC ISO timestamp ready for the API.
 *
 * Falls back to midnight ("00:00") when hora is empty so the date input alone
 * is enough to produce a valid timestamp.
 */
export function combineFechaHora(fecha: string, hora: string): string {
  return fechaEventoToISO(`${fecha}T${hora || "00:00"}`);
}

/**
 * Extract the **local** date and time from a UTC ISO timestamp (as stored in
 * the DB) so the edit form shows the same wall-clock time the user originally
 * entered, regardless of the host machine's UTC offset.
 *
 * Bug this fixes: using `.toISOString().slice(0,10/11,16)` returns UTC digits,
 * causing a ±N-hour shift when the user re-opens the edit form. For example, a
 * user in UTC-3 who saves "15:30 local" sees "18:30" on re-open because the
 * DB stores "18:30 UTC" and `.toISOString()` echoes that UTC value back.
 *
 * Using `getFullYear/Month/Date/Hours/Minutes` reads the Date object in the
 * local timezone, which is the inverse of how `new Date("YYYY-MM-DDTHH:MM")`
 * interprets a datetime-local string — making the round-trip lossless.
 */
export function eventoFechaToLocal(isoTimestamp: string): { fecha: string; hora: string } {
  const d = new Date(isoTimestamp);
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins  = String(d.getMinutes()).padStart(2, "0");
  return {
    fecha: `${year}-${month}-${day}`,
    hora:  `${hours}:${mins}`,
  };
}

export interface EventoSlot {
  id: string;
  fecha_evento: string; // ISO timestamptz
  duracion_horas: number;
  duracion_minutos: number;
}

/** Total event duration in milliseconds */
function durationMs(horas: number, minutos: number): number {
  return (horas * 60 + minutos) * 60_000;
}

/**
 * Returns true if `proposed` overlaps with any event in `existing`.
 * Overlap: start1 < end2 && end1 > start2
 * `excludeId` is skipped (used when editing an existing event).
 */
export function hayConflicto(
  proposed: { fecha_evento: string; duracion_horas: number; duracion_minutos: number },
  existing: EventoSlot[],
  excludeId?: string
): boolean {
  const start1 = new Date(proposed.fecha_evento).getTime();
  const end1 = start1 + durationMs(proposed.duracion_horas, proposed.duracion_minutos);

  for (const ev of existing) {
    if (excludeId && ev.id === excludeId) continue;
    const start2 = new Date(ev.fecha_evento).getTime();
    const end2 = start2 + durationMs(ev.duracion_horas, ev.duracion_minutos);
    if (start1 < end2 && end1 > start2) return true;
  }
  return false;
}
