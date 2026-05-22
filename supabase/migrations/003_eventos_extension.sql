-- ============================================================
-- EventOS — Eventos Extension
-- Adds pricing/capacity columns and extends estado CHECK
-- ============================================================

ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS duracion_horas    INTEGER        NOT NULL DEFAULT 2 CHECK (duracion_horas > 0),
  ADD COLUMN IF NOT EXISTS num_ninos_extra   INTEGER        NOT NULL DEFAULT 0 CHECK (num_ninos_extra >= 0),
  ADD COLUMN IF NOT EXISTS num_adultos       INTEGER        NOT NULL DEFAULT 0 CHECK (num_adultos >= 0),
  ADD COLUMN IF NOT EXISTS precio_nino_extra NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_nino_extra >= 0),
  ADD COLUMN IF NOT EXISTS precio_adulto     NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_adulto >= 0),
  ADD COLUMN IF NOT EXISTS descuento         NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (descuento >= 0);

-- Extend estado to include 'pendiente'
ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_estado_check;
ALTER TABLE eventos ADD CONSTRAINT eventos_estado_check
  CHECK (estado IN ('pendiente', 'cotizacion', 'confirmado', 'en_curso', 'completado', 'cancelado'));

-- Index: overlap detection queries by fecha_evento
CREATE INDEX IF NOT EXISTS idx_eventos_fecha_evento ON eventos (fecha_evento);
-- Index: filter by estado
CREATE INDEX IF NOT EXISTS idx_eventos_estado ON eventos (estado);
