/** Minimum age required for the birthday child */
export const MIN_EDAD_FESTEJADO = 5;

/**
 * Validates an email address format.
 * Returns false for empty strings — callers should treat empty as "not provided".
 */
export function validarEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/**
 * Validates an international phone number.
 * Accepts E.164 (+521234567890) or formatted variants with spaces/dashes/parens.
 * Requires 7–15 digits (ITU-T E.164 range) after stripping formatting characters.
 */
export function validarTelefono(telefono: string): boolean {
  if (!telefono) return false;
  const stripped = telefono.replace(/[\s\-.()+ ]/g, "");
  return /^\d{7,15}$/.test(stripped);
}

/**
 * Calculates completed years of age from an ISO date string ("YYYY-MM-DD").
 * Accepts an optional `today` parameter for deterministic testing.
 * Returns -1 if the date is missing or unparseable.
 */
export function calcularEdad(fechaNacimiento: string, today = new Date()): number {
  if (!fechaNacimiento) return -1;

  const parts = fechaNacimiento.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return -1;
  const [birthYear, birthMonth, birthDay] = parts;

  let edad = today.getFullYear() - birthYear;
  const monthDiff = (today.getMonth() + 1) - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDay)) {
    edad--;
  }
  return edad;
}

/**
 * Returns true if the person born on `fechaNacimiento` is at least `minYears` old.
 */
export function edadMinimaOk(
  fechaNacimiento: string,
  minYears = MIN_EDAD_FESTEJADO,
  today = new Date()
): boolean {
  const edad = calcularEdad(fechaNacimiento, today);
  return edad >= minYears;
}
