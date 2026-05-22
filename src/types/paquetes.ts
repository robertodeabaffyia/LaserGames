import type { Item } from "./items";

export interface PaqueteItem {
  id: string;
  paquete_id: string;
  item_id: string;
  cantidad: number;
  item?: Item;
}

export interface Paquete {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  duracion_horas: number;
  /** Extra minutes on top of duracion_horas (0–59) */
  duracion_minutos: number;
  /** Maximum children the venue can accommodate */
  cantidad_ninos_max: number;
  /** Maximum adults the venue can accommodate */
  cantidad_adultos_max: number;
  /** Children included in the package price */
  cantidad_ninos_incluidos: number;
  /** Adults included in the package price */
  cantidad_adultos_incluidos: number;
  es_activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaqueteWithItems extends Paquete {
  paquete_items: (PaqueteItem & { item: Item })[];
}

export type PaqueteInsert = Omit<Paquete, "id" | "created_at" | "updated_at">;
export type PaqueteUpdate = Partial<PaqueteInsert>;

export interface ItemInput {
  item_id: string;
  cantidad: number;
}
