-- ============================================================
-- Escape Room module — TANDA 3: reservas por WhatsApp + seña MP
-- Bot de menú guiado por WhatsApp (Vonage inbound) que crea
-- reservas en estado 'pendiente_sena'; el webhook de Mercado Pago
-- confirma la seña y pasa la reserva a 'reservada'.
-- ============================================================

-- ------------------------------------------------------------
-- escape_reservas: nuevo estado 'pendiente_sena' + tracking de seña/MP
--
-- El constraint original fue creado inline como CHECK sobre la columna,
-- por lo que Postgres lo nombró escape_reservas_estado_check.
-- ------------------------------------------------------------
ALTER TABLE escape_reservas DROP CONSTRAINT IF EXISTS escape_reservas_estado_check;
ALTER TABLE escape_reservas ADD CONSTRAINT escape_reservas_estado_check
  CHECK (estado IN ('pendiente_sena', 'reservada', 'completada', 'cancelada'));

ALTER TABLE escape_reservas
  ADD COLUMN IF NOT EXISTS origen           TEXT NOT NULL DEFAULT 'manual'
    CHECK (origen IN ('manual', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS sena_monto       NUMERIC(10, 2) CHECK (sena_monto >= 0),
  ADD COLUMN IF NOT EXISTS sena_pagada      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mp_preference_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_payment_id    TEXT;

-- ------------------------------------------------------------
-- whatsapp_conversaciones — una fila por teléfono, con el estado
-- de la conversación del bot y las respuestas parciales (datos).
-- El webhook accede con el service-role key (bypass RLS); la
-- policy authenticated es para inspección futura desde el panel.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_conversaciones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono   TEXT NOT NULL UNIQUE,
  estado     TEXT NOT NULL DEFAULT 'inicio',
  datos      JSONB NOT NULL DEFAULT '{}',
  reserva_id UUID REFERENCES escape_reservas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER whatsapp_conversaciones_updated_at
  BEFORE UPDATE ON whatsapp_conversaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE whatsapp_conversaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON whatsapp_conversaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
