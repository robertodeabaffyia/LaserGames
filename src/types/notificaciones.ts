export type NotificacionTipo =
  | "evento_recordatorio"
  | "promocion_cumpleanos"
  | "confirmacion_evento"
  | "campania_cumpleanos"
  | "solicitud_resena";

export type NotificacionCanal = "email" | "whatsapp" | "ambos";
export type NotificacionStatus = "enviado" | "fallido";

export const NOTIFICACION_TIPOS: NotificacionTipo[] = [
  "evento_recordatorio",
  "promocion_cumpleanos",
  "confirmacion_evento",
  "campania_cumpleanos",
  "solicitud_resena",
];

export const NOTIFICACION_TIPO_LABELS: Record<NotificacionTipo, string> = {
  evento_recordatorio: "Recordatorio de evento",
  promocion_cumpleanos: "Promoción cumpleaños",
  confirmacion_evento: "Confirmación de evento",
  campania_cumpleanos: "Campaña cumpleaños próximos",
  solicitud_resena: "Solicitud de reseña",
};

export const CANAL_LABELS: Record<NotificacionCanal, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  ambos: "Email + WhatsApp",
};

export interface NotificacionConfig {
  id: string;
  tipo: NotificacionTipo;
  descripcion: string;
  habilitada: boolean;
  canal: NotificacionCanal;
  dias_anticipacion: number;
  contenido_template: string;
  variables_disponibles: string[];
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificacionConfigUpdate = {
  descripcion?: string;
  habilitada?: boolean;
  canal?: NotificacionCanal;
  dias_anticipacion?: number;
  contenido_template?: string;
};

export interface HistorialNotificacion {
  id: string;
  notificacion_config_id: string | null;
  tipo_notificacion: NotificacionTipo;
  entidad_id: string | null;
  destinatario: string;
  canal: "email" | "whatsapp";
  contenido_enviado: string;
  status: NotificacionStatus;
  error_detalle: string | null;
  fecha_envio: string;
}

export interface ClienteDesuscripcion {
  id: string;
  cliente_id: string;
  tipo_notificacion: NotificacionTipo;
  desuscrito: boolean;
  updated_at: string;
}

export interface EnvioResult {
  ok: boolean;
  error?: string;
}

// ── Campaña cumpleaños próximos ──────────────────────────────────────────────

/** One entry in the campaign target list */
export interface CampaniaTarget {
  hijo_id: string;
  hijo_nombre: string;
  fecha_nacimiento: string; // YYYY-MM-DD
  dias_hasta_cumple: number;
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_email: string | null;
  tiene_evento_futuro: boolean; // true = already has an upcoming booking
}

export interface CampaniaEnviarBody {
  hijo_ids: string[];
  template: string;
  canal: NotificacionCanal;
}

export interface CampaniaEnviarResult {
  enviados: number;
  omitidos: number; // unsubscribed or no contact info
  errores: string[];
}
