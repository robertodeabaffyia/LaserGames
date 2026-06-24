import type { TarjetaRecargos } from "@/types/configuracion";

export const ESCAPE_PRECIO_MIN_CANTIDAD = 2;
export const ESCAPE_PRECIO_MAX_CANTIDAD = 10;

export interface SalaEscape {
  id: string;
  nombre: string;
  activa: boolean;
  created_at: string;
}

export interface EscapeConfig {
  id: number;
  hora_inicio_reservas: string;
  hora_fin_reservas: string;
  duracion_bloque_min: number;
  sena_minima: number;
  recargo_transferencia_pct: number;
  precio_sala_completa: number;
  created_at: string;
  updated_at: string;
  /**
   * Card surcharges, read-only here: sourced from the birthday
   * `configuraciones` table and shared with the Escape Room module.
   * There is no escape_config.tarjeta_recargos column — edit them from
   * Configuración (cumpleaños) instead.
   */
  tarjeta_recargos: TarjetaRecargos;
}

export type EscapeConfigUpdate = {
  hora_inicio_reservas: string;
  hora_fin_reservas: string;
  duracion_bloque_min: number;
  sena_minima: number;
  recargo_transferencia_pct: number;
  precio_sala_completa: number;
};

export interface EscapePrecioPersona {
  id: string;
  sala_id: string | null;
  cantidad: number;
  precio_por_persona: number;
  created_at: string;
  updated_at: string;
}

/** PUT body: full replacement of the global (sala_id = null) price tiers, keyed by cantidad. */
export type EscapePreciosUpdate = {
  precios: Partial<Record<number, number>>;
};
