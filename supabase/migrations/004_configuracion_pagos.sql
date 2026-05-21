-- ============================================================
-- EventOS — Configuración & Pagos Extension
-- ============================================================

-- ------------------------------------------------------------
-- configuraciones (per-user admin settings)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuraciones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monto_seña       NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (monto_seña >= 0),
  -- tarjeta_recargos JSON shape:
  -- { "VISA": {"1": 0, "3": 3.5, "6": 5.5, "12": 9.0},
  --   "MASTERCARD": {...}, "AMEX": {...} }
  tarjeta_recargos JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id)
);

CREATE TRIGGER configuraciones_updated_at
  BEFORE UPDATE ON configuraciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE configuraciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios leen su configuracion"
  ON configuraciones FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "admins gestionan configuracion"
  ON configuraciones FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- ------------------------------------------------------------
-- Extend pagos: tarjeta details
-- ------------------------------------------------------------
ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS tipo_tarjeta TEXT
    CHECK (tipo_tarjeta IN ('VISA', 'MASTERCARD', 'AMEX')),
  ADD COLUMN IF NOT EXISTS num_cuotas   INTEGER CHECK (num_cuotas > 0),
  ADD COLUMN IF NOT EXISTS recargo_pct  NUMERIC(5, 2) DEFAULT 0 CHECK (recargo_pct >= 0);

-- Index: list pagos by evento quickly
CREATE INDEX IF NOT EXISTS idx_pagos_evento_id ON pagos (evento_id);
