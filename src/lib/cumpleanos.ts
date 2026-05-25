/**
 * Utilities for birthday-campaign calculations.
 * Pure functions — safe to import in API routes and tests.
 */

/**
 * Days from `hoy` until the next occurrence of the birthday encoded in
 * `fechaNacimiento` (YYYY-MM-DD).  Returns 0 if today IS the birthday,
 * and handles year wraparound correctly (e.g. Dec 28 → Jan 3 = 6 days).
 */
export function diasHastaCumple(fechaNacimiento: string, hoy: Date): number {
  const [, mm, dd] = fechaNacimiento.split("-").map(Number);

  // Birthday in the current calendar year
  const thisYear = new Date(hoy.getFullYear(), mm - 1, dd);
  thisYear.setHours(0, 0, 0, 0);

  const base = new Date(hoy);
  base.setHours(0, 0, 0, 0);

  const diff = Math.ceil(
    (thisYear.getTime() - base.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diff >= 0) return diff;

  // Birthday already passed this year → use next year's occurrence
  const nextYear = new Date(hoy.getFullYear() + 1, mm - 1, dd);
  nextYear.setHours(0, 0, 0, 0);
  return Math.ceil((nextYear.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format a YYYY-MM-DD birthday as "15 de agosto" (localized for Argentina).
 * The year of the *next* occurrence is used for the Date, but only day+month
 * is rendered.
 */
export function formatFechaCumple(fechaNacimiento: string, hoy: Date): string {
  const [, mm, dd] = fechaNacimiento.split("-").map(Number);
  const dias = diasHastaCumple(fechaNacimiento, hoy);
  // Use the year the next birthday falls in
  const year = dias === 0 ? hoy.getFullYear()
    : new Date(hoy.getFullYear(), mm - 1, dd) < hoy
      ? hoy.getFullYear() + 1
      : hoy.getFullYear();

  const date = new Date(year, mm - 1, dd);
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
}

export const DEFAULT_TEMPLATE = `¡Hola {{nombre_cliente}}! 🎂

El cumpleaños de {{nombre_hijo}} se acerca en {{dias_hasta_cumple}} días ({{fecha_cumple}}).

¿Ya tenés los planes para celebrarlo como se merece? En Laser Games hacemos cumpleaños increíbles: laser tag, decoración, torta y mucho más.

¡Reservá tu fecha antes de que se ocupe! Escribinos y te armamos una cotización 🎮🎉`;

export const TEMPLATE_VARIABLES = [
  { key: "nombre_cliente",   label: "Nombre del padre/madre" },
  { key: "nombre_hijo",      label: "Nombre del festejado" },
  { key: "fecha_cumple",     label: "Fecha del cumpleaños" },
  { key: "dias_hasta_cumple",label: "Días restantes" },
] as const;
