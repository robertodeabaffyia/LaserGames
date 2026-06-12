/** Event duration formatting and bounds (hours + minutes). */
export const MAX_HORAS = 24;
export const MAX_MINUTOS = 59;

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
  const m = Math.min(MAX_MINUTOS, Math.max(0, Math.floor(minutos)));

  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

/**
 * Remove leading zeros from a numeric string, keeping at least "0".
 * "030" → "30", "00" → "0", "5" → "5".
 */
export function trimLeadingZeros(s: string): string {
  return s.replace(/^0+(\d)/, "$1") || "0";
}

/**
 * Parse a raw string into a valid hours value.
 * Returns null when the string is not a valid non-negative integer.
 * Otherwise clamps to [minHoras, MAX_HORAS].
 */
export function parseHoras(raw: string, minHoras = 1): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) return null;
  return Math.max(minHoras, Math.min(MAX_HORAS, parseInt(trimmed, 10)));
}

/**
 * Parse a raw string into a valid minutes value.
 * Returns null when the string is not a valid non-negative integer.
 * Otherwise clamps to [0, MAX_MINUTOS].
 */
export function parseMinutos(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) return null;
  return Math.min(MAX_MINUTOS, Math.max(0, parseInt(trimmed, 10)));
}
