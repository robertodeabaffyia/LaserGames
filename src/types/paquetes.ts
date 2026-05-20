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
  max_invitados: number;
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
