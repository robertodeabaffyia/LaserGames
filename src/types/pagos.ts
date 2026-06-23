import type { TarjetaNombre } from "./configuracion";

export type TipoDescuento = "porcentaje" | "monto";
export type AccionAuditoria = "crear" | "editar" | "eliminar";

export interface Pago {
  id: string;
  evento_id: string;
  monto: number;            // base amount before discount
  metodo: "efectivo" | "tarjeta" | "transferencia";
  tipo_tarjeta: TarjetaNombre | null;
  num_cuotas: number | null;
  recargo_pct: number;
  fecha_pago: string;       // ISO timestamptz
  notas: string | null;
  quien_recibio: string | null;
  // discount fields (added in migration 009)
  tiene_descuento: boolean;
  tipo_descuento: TipoDescuento | null;
  valor_descuento: number | null;
  monto_final: number | null; // null = same as monto (backward-compat)
  created_at: string;
}

export type MetodoPago = Pago["metodo"];

export type PagoInsert = {
  evento_id: string;
  monto: number;
  metodo: MetodoPago;
  tipo_tarjeta?: TarjetaNombre | null;
  num_cuotas?: number | null;
  notas?: string | null;
  quien_recibio?: string | null;
  fecha_pago?: string;
  // discount (optional)
  tiene_descuento?: boolean;
  tipo_descuento?: TipoDescuento | null;
  valor_descuento?: number | null;
  // surcharge override: only accepted from admin users; server derives from config otherwise
  recargo_pct?: number;
};

export type PagoUpdate = {
  notas?: string | null;
  quien_recibio?: string | null;
  fecha_pago?: string;
  monto?: number;
  metodo?: MetodoPago;
  // surcharge update: admin-only; server rejects if sender is not admin
  recargo_pct?: number;
};

/** Effective amount credited toward the event balance. */
export function montoEfectivo(pago: Pick<Pago, "monto" | "monto_final">): number {
  return pago.monto_final ?? pago.monto;
}

export interface ResumenPago {
  evento_id: string;
  precio_total: number;
  total_pagado: number;
  saldo_pendiente: number;
  credito: number;
}

export interface PagoAuditoria {
  id: string;
  pago_id: string;
  accion: AccionAuditoria;
  fecha: string; // ISO timestamptz
  usuario_id: string | null;
  cambios: Record<string, unknown>;
}

/** Payment colour status derived from amounts paid vs total / seña */
export type EstadoPago = "sin_pago" | "con_sena" | "pagado";

export function calcularEstadoPago(
  totalPagado: number,
  precioTotal: number,
  montoSena: number
): EstadoPago {
  if (totalPagado >= precioTotal) return "pagado";
  if (montoSena > 0 && totalPagado >= montoSena) return "con_sena";
  return "sin_pago";
}
