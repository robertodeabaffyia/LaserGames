import type { Hijo } from "./hijos";

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  fecha_cumpleanos: string | null; // ISO date "YYYY-MM-DD"
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClienteConHijos extends Cliente {
  hijos: Hijo[];
}

export interface EventoResumen {
  id: string;
  fecha_evento: string;
  estado: string;
  precio_total: number;
  nombre_festejado: string;
  paquete: { nombre: string } | null;
  pagos_total?: number;
}

export interface ClientePerfil extends ClienteConHijos {
  eventos: EventoResumen[];
}

export type ClienteInsert = Omit<Cliente, "id" | "created_at" | "updated_at" | "fecha_cumpleanos"> & {
  fecha_cumpleanos?: string | null;
};
export type ClienteUpdate = Partial<ClienteInsert>;
