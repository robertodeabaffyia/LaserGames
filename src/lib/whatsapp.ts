/**
 * Builds a WhatsApp click-to-chat (wa.me) URL.
 *
 * @param telefono Phone in any human format ("+54 9 387 1234567", "387-123…").
 *                 Non-digits are stripped; leading 00 is removed.
 * @param mensaje  Optional pre-filled message.
 * @returns The wa.me URL, or null when the phone has fewer than 7 digits.
 */
export function buildWhatsAppLink(
  telefono: string | null | undefined,
  mensaje?: string
): string | null {
  if (!telefono) return null;
  let digits = telefono.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 7) return null;

  const base = `https://wa.me/${digits}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
