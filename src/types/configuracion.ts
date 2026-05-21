export type TarjetaNombre = "VISA" | "MASTERCARD" | "AMEX";
export type CuotasClave = "1" | "3" | "6" | "12";

/** Per-cuota surcharge percentages for a single card brand */
export type CuotasRecargo = Partial<Record<CuotasClave, number>>;

/** Full tarjeta_recargos JSON shape */
export type TarjetaRecargos = Partial<Record<TarjetaNombre, CuotasRecargo>>;

export const TARJETAS: TarjetaNombre[] = ["VISA", "MASTERCARD", "AMEX"];
export const CUOTAS: CuotasClave[] = ["1", "3", "6", "12"];

export const DEFAULT_RECARGOS: TarjetaRecargos = {
  VISA: { "1": 0, "3": 3.5, "6": 5.5, "12": 9.0 },
  MASTERCARD: { "1": 0, "3": 3.5, "6": 5.5, "12": 9.0 },
  AMEX: { "1": 2.0, "3": 5.0, "6": 7.0, "12": 11.0 },
};

export interface Configuracion {
  id: string;
  usuario_id: string;
  monto_seña: number;
  tarjeta_recargos: TarjetaRecargos;
  created_at: string;
  updated_at: string;
}

export type ConfiguracionUpdate = {
  monto_seña: number;
  tarjeta_recargos: TarjetaRecargos;
};
