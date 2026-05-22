-- ============================================================
-- EventOS — Migration 008: notification system
-- ============================================================

CREATE TABLE IF NOT EXISTS notificaciones_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                  TEXT NOT NULL CHECK (tipo IN (
                          'evento_recordatorio', 'promocion_cumpleanos', 'confirmacion_evento'
                        )),
  descripcion           TEXT NOT NULL,
  habilitada            BOOLEAN NOT NULL DEFAULT true,
  canal                 TEXT NOT NULL CHECK (canal IN ('email', 'whatsapp', 'ambos')),
  dias_anticipacion     INTEGER NOT NULL DEFAULT 1 CHECK (dias_anticipacion >= 0),
  contenido_template    TEXT NOT NULL,
  variables_disponibles JSONB NOT NULL DEFAULT '[]',
  creado_por            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notificaciones_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON notificaciones_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER notificaciones_config_updated_at
  BEFORE UPDATE ON notificaciones_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── historial_notificaciones ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS historial_notificaciones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacion_config_id UUID REFERENCES notificaciones_config(id) ON DELETE SET NULL,
  tipo_notificacion     TEXT NOT NULL,
  entidad_id            UUID,          -- evento_id, cliente_id or hijo_id
  destinatario          TEXT NOT NULL, -- email address or phone number
  canal                 TEXT NOT NULL CHECK (canal IN ('email', 'whatsapp')),
  contenido_enviado     TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('enviado', 'fallido')),
  error_detalle         TEXT,
  fecha_envio           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE historial_notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON historial_notificaciones
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS historial_notif_config_idx  ON historial_notificaciones (notificacion_config_id);
CREATE INDEX IF NOT EXISTS historial_notif_tipo_idx    ON historial_notificaciones (tipo_notificacion);
CREATE INDEX IF NOT EXISTS historial_notif_entidad_idx ON historial_notificaciones (entidad_id);
CREATE INDEX IF NOT EXISTS historial_notif_fecha_idx   ON historial_notificaciones (fecha_envio);

-- ── cliente_desuscripciones ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cliente_desuscripciones (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id         UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo_notificacion  TEXT NOT NULL CHECK (tipo_notificacion IN (
                       'evento_recordatorio', 'promocion_cumpleanos', 'confirmacion_evento'
                     )),
  desuscrito         BOOLEAN NOT NULL DEFAULT true,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cliente_id, tipo_notificacion)
);

ALTER TABLE cliente_desuscripciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON cliente_desuscripciones
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS desuscripciones_cliente_idx ON cliente_desuscripciones (cliente_id);

-- ── Seed 3 default notification configs ──────────────────────────────────────

INSERT INTO notificaciones_config
  (tipo, descripcion, habilitada, canal, dias_anticipacion, contenido_template, variables_disponibles)
VALUES
  (
    'evento_recordatorio',
    'Recordatorio de evento próximo',
    true, 'ambos', 1,
    '¡Hola {{nombre_cliente}}! Te recordamos que mañana es el evento de {{nombre_festejado}} 🎉. Fecha: {{fecha_evento}} a las {{hora_evento}}. ¡Te esperamos!',
    '["nombre_cliente","nombre_festejado","fecha_evento","hora_evento","nombre_paquete"]'
  ),
  (
    'promocion_cumpleanos',
    'Promoción especial por cumpleaños',
    true, 'ambos', 7,
    '¡Hola {{nombre_cliente}}! 🎂 El cumpleaños de {{nombre_hijo}} se acerca en {{dias_hasta_cumpleanos}} días. ¡Celebra en EventOS y obtén un descuento especial! Contáctanos para reservar.',
    '["nombre_cliente","nombre_hijo","fecha_nacimiento","dias_hasta_cumpleanos"]'
  ),
  (
    'confirmacion_evento',
    'Confirmación de evento al pagar seña',
    true, 'ambos', 0,
    '¡Hola {{nombre_cliente}}! ✅ Tu evento de {{nombre_festejado}} ha sido confirmado para el {{fecha_evento}}. Monto abonado: ${{monto_pagado}}. Saldo pendiente: ${{saldo_pendiente}}. ¡Gracias!',
    '["nombre_cliente","nombre_festejado","fecha_evento","monto_pagado","saldo_pendiente"]'
  )
ON CONFLICT DO NOTHING;
