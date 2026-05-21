export interface PrecioParams {
  precioPaquete: number;
  numNinosExtra: number;
  precioNinoExtra: number;
  numAdultos: number;
  precioAdulto: number;
  descuento: number;
}

/**
 * Calculates the total price of an event.
 * precio_total = paquete + (niños_extra × precio_niño) + (adultos × precio_adulto) - descuento
 * Result is clamped to >= 0.
 */
export function calcularPrecioTotal(params: PrecioParams): number {
  const {
    precioPaquete,
    numNinosExtra,
    precioNinoExtra,
    numAdultos,
    precioAdulto,
    descuento,
  } = params;
  const subtotal =
    precioPaquete +
    numNinosExtra * precioNinoExtra +
    numAdultos * precioAdulto;
  return Math.max(0, subtotal - descuento);
}

export interface EventoSlot {
  id: string;
  fecha_evento: string; // ISO timestamptz
  duracion_horas: number;
}

/**
 * Returns true if `proposed` overlaps with any event in `existing`.
 * Overlap: start1 < end2 && end1 > start2
 * `excludeId` is skipped (used when editing an existing event).
 */
export function hayConflicto(
  proposed: { fecha_evento: string; duracion_horas: number },
  existing: EventoSlot[],
  excludeId?: string
): boolean {
  const start1 = new Date(proposed.fecha_evento).getTime();
  const end1 = start1 + proposed.duracion_horas * 3_600_000;

  for (const ev of existing) {
    if (excludeId && ev.id === excludeId) continue;
    const start2 = new Date(ev.fecha_evento).getTime();
    const end2 = start2 + ev.duracion_horas * 3_600_000;
    if (start1 < end2 && end1 > start2) return true;
  }
  return false;
}
