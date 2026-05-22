/**
 * Format a duration expressed as whole hours + extra minutes into a compact
 * human-readable string.
 *
 * Examples:
 *   formatDuration(2, 0)  → "2h"
 *   formatDuration(2, 30) → "2h 30min"
 *   formatDuration(0, 45) → "45min"
 */
export function formatDuration(horas: number, minutos: number): string {
  const h = Math.max(0, Math.floor(horas));
  const m = Math.min(59, Math.max(0, Math.floor(minutos)));

  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}
