export interface Hijo {
  id: string;
  cliente_id: string;
  nombre: string;
  fecha_nacimiento: string; // ISO date "YYYY-MM-DD"
  colegio: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export type HijoInsert = Omit<Hijo, "id" | "created_at" | "updated_at">;
export type HijoUpdate = Partial<Omit<HijoInsert, "cliente_id">>;
