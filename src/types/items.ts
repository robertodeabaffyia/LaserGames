export interface Item {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: "actividad" | "comida" | "bebida" | "decoracion" | "general";
  unidad: string;
  es_activo: boolean;
  created_at: string;
  updated_at: string;
}

export type ItemInsert = Omit<Item, "id" | "created_at" | "updated_at">;
export type ItemUpdate = Partial<ItemInsert>;

export const ITEM_CATEGORIAS = [
  "actividad",
  "comida",
  "bebida",
  "decoracion",
  "general",
] as const;
