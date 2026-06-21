/**
 * Shared business logic for payment (pago) operations.
 */

/**
 * Recomputes and persists evento.estado after any payment mutation
 * (create, update, or delete). Returns the resolved estado string so
 * callers can include it in their response without an extra DB fetch.
 *
 * Thresholds:
 *   totalPagado >= precio_total                  → "completado"
 *   montoSena > 0 && totalPagado >= montoSena    → "confirmado"
 *   otherwise                                    → "pendiente"
 *
 * The estado is always written when it differs from the current value,
 * including downgrades (e.g. completado → pendiente after a deletion).
 */
export async function recalcularEstadoEvento(
  // Supabase client — typed as any to match the helper pattern in auth-helpers.ts
  // (full typing requires the generated Database types, which aren't wired up here).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  eventoId: string,
  userId: string
): Promise<string> {
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, precio_total, estado")
    .eq("id", eventoId)
    .single();

  if (!evento) return "pendiente";

  const { data: allPagos } = await supabase
    .from("pagos")
    .select("monto, monto_final")
    .eq("evento_id", eventoId);

  if (!allPagos) return evento.estado as string;

  const totalPagado = (
    allPagos as { monto: number; monto_final: number | null }[]
  ).reduce((sum, p) => sum + (p.monto_final ?? p.monto), 0);

  const { data: configRaw } = await supabase
    .from("configuraciones")
    .select("monto_seña")
    .eq("usuario_id", userId)
    .single();

  const montoSena =
    (configRaw as { monto_seña?: number } | null)?.monto_seña ?? 0;

  let nuevoEstado: string;
  if (totalPagado >= evento.precio_total) {
    nuevoEstado = "completado";
  } else if (montoSena > 0 && totalPagado >= montoSena) {
    nuevoEstado = "confirmado";
  } else {
    nuevoEstado = "pendiente";
  }

  if (nuevoEstado !== evento.estado) {
    await supabase
      .from("eventos")
      .update({ estado: nuevoEstado })
      .eq("id", eventoId);
  }

  return nuevoEstado;
}
