-- ============================================================
-- EventOS — Migration 010: mejoras_eventos
-- Adds capacity and duration fields to paquetes;
-- adds total-attendance columns to eventos.
-- ============================================================

-- ── paquetes ──────────────────────────────────────────────────────────────────

ALTER TABLE paquetes
  ADD COLUMN IF NOT EXISTS cantidad_ninos_incluidos   INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_ninos_incluidos >= 0),
  ADD COLUMN IF NOT EXISTS cantidad_adultos_incluidos INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_adultos_incluidos >= 0),
  ADD COLUMN IF NOT EXISTS duracion_minutos           INTEGER NOT NULL DEFAULT 0 CHECK (duracion_minutos >= 0);

COMMENT ON COLUMN paquetes.cantidad_ninos_incluidos   IS 'Children included in the package price';
COMMENT ON COLUMN paquetes.cantidad_adultos_incluidos IS 'Adults included in the package price';
COMMENT ON COLUMN paquetes.duracion_minutos           IS 'Extra minutes on top of duracion_horas (0–59)';

-- ── eventos ───────────────────────────────────────────────────────────────────

ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS cantidad_ninos_totales   INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_ninos_totales >= 0),
  ADD COLUMN IF NOT EXISTS cantidad_adultos_totales INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_adultos_totales >= 0),
  ADD COLUMN IF NOT EXISTS duracion_minutos         INTEGER NOT NULL DEFAULT 0 CHECK (duracion_minutos >= 0);

COMMENT ON COLUMN eventos.cantidad_ninos_totales   IS 'Total children attending (extra = total - paquete.cantidad_ninos_incluidos)';
COMMENT ON COLUMN eventos.cantidad_adultos_totales IS 'Total adults attending (extra = total - paquete.cantidad_adultos_incluidos)';
COMMENT ON COLUMN eventos.duracion_minutos         IS 'Extra minutes copied from paquete at creation time';
