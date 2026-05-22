import type { TarjetaNombre } from "./configuracion";

export type TipoDescuento = "porcentaje" | "monto";

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
  fecha_pago?: string;
  // discount (optional)
  tiene_descuento?: boolean;
  tipo_descuento?: TipoDescuento | null;
  valor_descuento?: number | null;
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
