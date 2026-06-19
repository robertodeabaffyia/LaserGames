/**
 * Pure date-formatting utilities — all functions are null/undefined-safe.
 *
 * Design rule: use direct Date property accessors (getDate, getMonth, …)
 * so output is always in the user's LOCAL timezone and never depends on
 * the host locale settings. This avoids Intl.DateTimeFormat surprises on
 * different environments (SSR, CI, Windows vs Linux, etc.).
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Converts a value to a Date.
 * - Date-only strings ("YYYY-MM-DD") are interpreted as local noon to avoid
 *   UTC-midnight timezone shift (e.g. "2026-05-23" becoming May 22 in UTC-6).
 * - All other strings are parsed with `new Date()`.
 * Returns null for null, undefined, or invalid dates.
 */
function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  // Date-only YYYY-MM-DD → local noon to sidestep timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(value);
  return isNaN(dt.getTime()) ? null : dt;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** dd/mm/yyyy — e.g. 23/05/2026. Returns "—" for null/undefined/invalid. */
export function formatFecha(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** dd/mm/yyyy HH:mm — e.g. 23/05/2026 15:30. Returns "—" for null/undefined/invalid. */
export function formatFechaHora(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** dd de mes yyyy — e.g. 23 de mayo 2026. Returns "—" for null/undefined/invalid. */
export function formatFechaMes(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** dd de mes — e.g. 23 de mayo (no year). Useful for recurring dates like birthdays. */
export function formatDiaMes(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** HH:mm — e.g. 15:30. Returns "—" for null/undefined/invalid. */
export function formatHora(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Converts a UTC ISO timestamp (or a Date) to a "YYYY-MM-DDTHH:MM" string
 * suitable for <input type="datetime-local">.
 *
 * Bug this prevents: using `.toISOString().slice(0, 16)` returns UTC digits,
 * so a 14:00 payment in Argentina (UTC-3) pre-fills the form as 17:00.
 * Using local accessors (getFullYear … getMinutes) reads the value in the
 * machine's own timezone, matching how the browser *writes* a datetime-local
 * value back with `new Date("YYYY-MM-DDTHH:MM").toISOString()`.
 */
export function isoToDatetimeLocal(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins  = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

/**
 * Parses a dd/mm/yyyy string into a Date (local midnight).
 * Returns null for null, undefined, or strings that don't match the format.
 */
export function parseFecha(str: string | null | undefined): Date | null {
  if (!str) return null;
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match.map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  // Validate — e.g. 31/02/2026 would shift to March
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}
