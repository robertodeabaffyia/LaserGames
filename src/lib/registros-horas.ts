/**
 * Pure utility functions for registros_horas validation and calculation.
 * All logic here is tested independently from the API layer.
 */

/**
 * Parses "HH:MM" into total minutes since midnight.
 */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Returns decimal hours worked (e.g. 7.5 for 07:00–14:30).
 * Assumes both strings are "HH:MM" and hora_salida > hora_entrada.
 */
export function calcularHorasTrabajadas(
  hora_entrada: string,
  hora_salida: string
): number {
  const diff = toMinutes(hora_salida) - toMinutes(hora_entrada);
  return Math.round((diff / 60) * 100) / 100; // 2 decimal places
}

/**
 * Returns true when hora_salida (HH:MM) is strictly after hora_entrada.
 */
export function validarHorario(
  hora_entrada: string,
  hora_salida: string
): boolean {
  return toMinutes(hora_salida) > toMinutes(hora_entrada);
}

/**
 * Returns true when fecha (YYYY-MM-DD) is today or in the past.
 * Uses UTC date comparison to avoid timezone edge cases.
 */
export function validarFechaNoFutura(fecha: string): boolean {
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  return fecha <= hoyStr;
}

/**
 * Formats a decimal number of hours as "Xh Ym" (e.g. 7.5 → "7h 30m").
 */
export function formatearHoras(horas: number): string {
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
