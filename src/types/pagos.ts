import type { TarjetaNombre } from "./configuracion";

export interface Pago {
  id: string;
  evento_id: string;
  monto: number;
  metodo: "efectivo" | "tarjeta" | "transferencia";
  tipo_tarjeta: TarjetaNombre | null;
  num_cuotas: number | null;
  recargo_pct: number;
  fecha_pago: string; // ISO timestamptz
  notas: string | null;
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
};

export interface ResumenPago {
  evento_id: string;
  precio_total: number;
  total_pagado: number;
  saldo_pendiente: number;
  credito: number;
}
