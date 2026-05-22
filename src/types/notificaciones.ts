export type NotificacionTipo =
  | "evento_recordatorio"
  | "promocion_cumpleanos"
  | "confirmacion_evento";

export type NotificacionCanal = "email" | "whatsapp" | "ambos";
export type NotificacionStatus = "enviado" | "fallido";

export const NOTIFICACION_TIPOS: NotificacionTipo[] = [
  "evento_recordatorio",
  "promocion_cumpleanos",
  "confirmacion_evento",
];

export const NOTIFICACION_TIPO_LABELS: Record<NotificacionTipo, string> = {
  evento_recordatorio: "Recordatorio de evento",
  promocion_cumpleanos: "Promoción cumpleaños",
  confirmacion_evento: "Confirmación de evento",
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
