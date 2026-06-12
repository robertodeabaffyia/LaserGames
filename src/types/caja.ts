export type MovimientoTipo = "ingreso" | "egreso";

export type MovimientoCategoria =
  | "pago_evento"
  | "salario"
  | "bono"
  | "compras"
  | "servicios"
  | "mantenimiento"
  | "otros";

export const MOVIMIENTO_CATEGORIAS: MovimientoCategoria[] = [
  "pago_evento",
  "salario",
  "bono",
  "compras",
  "servicios",
  "mantenimiento",
  "otros",
];

export const CATEGORIAS_MANUALES: MovimientoCategoria[] = [
  "compras",
  "servicios",
  "mantenimiento",
  "otros",
];

/** Human-readable labels for UI display — single source for every component. */
export const CATEGORIA_LABELS: Record<MovimientoCategoria, string> = {
  pago_evento: "Pago evento",
  salario: "Salario",
  bono: "Bono",
  compras: "Compras",
  servicios: "Servicios",
  mantenimiento: "Mantenimiento",
  otros: "Otros",
};

/** Label for a categoria coming from untyped sources (API rows); falls back to the raw value. */
export function categoriaLabel(categoria: string): string {
  return CATEGORIA_LABELS[categoria as MovimientoCategoria] ?? categoria;
}

export type FrecuenciaRepeticion = "mensual" | "semanal";

export interface MovimientoCaja {
  id: string;
  usuario_id: string | null;
  tipo: MovimientoTipo;
  categoria: MovimientoCategoria;
  descripcion: string;
  monto: number;
  fecha: string; // YYYY-MM-DD
  es_repetible: boolean;
  frecuencia_repeticion: FrecuenciaRepeticion | null;
  evento_id: string | null;
  empleado_id: string | null;
  created_at: string;
}

export type MovimientoCajaInsert = {
  tipo: MovimientoTipo;
  categoria: MovimientoCategoria;
  descripcion: string;
  monto: number;
  fecha?: string;
  es_repetible?: boolean;
  frecuencia_repeticion?: FrecuenciaRepeticion | null;
  evento_id?: string | null;
  empleado_id?: string | null;
};

export interface BonoEmpleado {
  id: string;
  empleado_id: string;
  mes: string; // YYYY-MM
  monto_bono: number;
  descripcion: string | null;
  creado_por: string | null;
  created_at: string;
}

export type BonoEmpleadoInsert = {
  empleado_id: string;
  mes: string;
  monto_bono: number;
  descripcion?: string | null;
};

export interface ResumenCaja {
  total_ingresos: number;
  total_egresos: number;
  ganancia_neta: number;
}

export interface NominaResultado {
  empleado_id: string;
  nombre: string;
  horas: number;
  tarifa: number;
  total_salario: number;
  total_bonos: number;
  total_egreso: number;
}
