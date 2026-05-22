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
