export type EventoEstado =
  | "pendiente"
  | "cotizacion"
  | "confirmado"
  | "en_curso"
  | "completado"
  | "cancelado";

export const EVENTO_ESTADOS: EventoEstado[] = [
  "pendiente",
  "cotizacion",
  "confirmado",
  "en_curso",
  "completado",
  "cancelado",
];

/** States that require admin privileges to set */
export const ADMIN_ONLY_ESTADOS: EventoEstado[] = ["completado", "cancelado"];

export interface Evento {
  id: string;
  cliente_id: string;
  paquete_id: string;
  promocion_id: string | null;
  fecha_evento: string; // ISO timestamptz
  nombre_festejado: string;
  edad_festejado: number | null;
  num_invitados: number;
  /** Total children attending (extras = total − paquete.cantidad_ninos_incluidos) */
  cantidad_ninos_totales: number;
  /** Total adults attending (extras = total − paquete.cantidad_adultos_incluidos) */
  cantidad_adultos_totales: number;
  precio_nino_extra: number;
  precio_adulto: number;
  descuento: number;
  duracion_horas: number;
  /** Extra minutes copied from paquete at creation time */
  duracion_minutos: number;
  estado: EventoEstado;
  precio_total: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventoConRelaciones extends Evento {
  cliente: { id: string; nombre: string; telefono: string | null; email: string | null };
  paquete: {
    id: string;
    nombre: string;
    precio: number;
    duracion_horas: number;
    duracion_minutos: number;
    cantidad_ninos_incluidos: number;
    cantidad_adultos_incluidos: number;
  };
  pagos?: { id: string; monto: number; monto_final: number | null; metodo: string; fecha_pago: string }[];
}

export type EventoInsert = {
  cliente_id: string;
  paquete_id: string;
  fecha_evento: string;
  nombre_festejado: string;
  edad_festejado?: number | null;
  num_invitados?: number;
  cantidad_ninos_totales?: number;
  cantidad_adultos_totales?: number;
  precio_nino_extra?: number;
  precio_adulto?: number;
  descuento?: number;
  notas?: string | null;
  promocion_id?: string | null;
  estado?: EventoEstado;
};

export type EventoUpdate = Partial<EventoInsert>;
