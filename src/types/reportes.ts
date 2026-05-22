export interface KPIs {
  ingresos_mes: number;
  egresos_mes: number;
  ganancia_neta: number;
  eventos_mes: number;
  pagos_pendientes: number;
  cumpleanos_proximos: number;
}

export interface ResumenDia {
  fecha: string; // YYYY-MM-DD
  ingresos: number;
  egresos: number;
}

export interface ReporteResumen {
  total_ingresos: number;
  total_egresos: number;
  ganancia_neta: number;
  por_dia: ResumenDia[];
}

export interface PaqueteStat {
  paquete_id: string;
  paquete_nombre: string;
  count: number;
  total_ingresos: number;
}

export interface EstadoStat {
  estado: string;
  count: number;
}

export interface ReporteEventos {
  total_eventos: number;
  total_ingresos: number;
  por_paquete: PaqueteStat[];
  paquete_mas_vendido: string | null;
  por_estado: EstadoStat[];
}

export interface ClienteRanking {
  cliente_id: string;
  nombre: string;
  total_eventos: number;
  primer_evento: string | null;
  ultimo_evento: string | null;
  proximo_evento: string | null;
  total_gastado: number;
}

export interface ReporteClientes {
  ranking: ClienteRanking[];
}

export interface EmpleadoStat {
  empleado_id: string;
  nombre: string;
  horas_trabajadas: number;
  salario_total: number;
  bonos_total: number;
  total_costo: number;
}

export interface ReporteEmpleados {
  resumen: EmpleadoStat[];
  top_empleado: string | null;
  total_horas: number;
  total_costo: number;
}

export interface CategoriaStat {
  categoria: string;
  tipo: "ingreso" | "egreso";
  total: number;
}

export interface ReporteMovimientos {
  total_ingresos: number;
  total_egresos: number;
  ganancia_neta: number;
  por_categoria: CategoriaStat[];
}

export type ReporteTipo = "kpis" | "resumen" | "eventos" | "clientes" | "empleados" | "movimientos";
