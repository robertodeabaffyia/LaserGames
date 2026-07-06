/**
 * Top-level WhatsApp bot menu: decides which reservation flow the user wants
 * (birthday events vs escape rooms) before delegating to the flow-specific
 * state machine in the webhook route.
 *
 * Pure helpers so the routing logic stays unit-testable.
 */

export type Flujo = "cumpleanos" | "escape";

export const MENU_PRINCIPAL =
  "¡Hola! Soy el asistente de reservas de Laser Games. 🎮\n" +
  "En cualquier momento podés escribir *cancelar* para volver a este menú.\n\n" +
  "¿Qué querés reservar? Respondé con el número:\n" +
  "1. Cumpleaños 🎉\n" +
  "2. Escape Room 🗝️";

/** Maps a main-menu selection ("1"/"2") to a flujo, or null if not understood. */
export function parseFlujo(texto: string): Flujo | null {
  const t = texto.trim();
  if (t === "1") return "cumpleanos";
  if (t === "2") return "escape";
  return null;
}

/** True when the user asked to reset the conversation. */
export function esCancelar(texto: string): boolean {
  return texto.trim().toLowerCase() === "cancelar";
}
