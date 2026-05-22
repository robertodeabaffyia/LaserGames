-- ── 012_refactor_invitados.sql ───────────────────────────────────────────────
-- Replace max_invitados on paquetes with separate ninos/adultos capacity.
-- Add per-unit extra prices to configuraciones.

-- ── paquetes ──────────────────────────────────────────────────────────────────
ALTER TABLE paquetes
  DROP COLUMN IF EXISTS max_invitados;

ALTER TABLE paquetes
  ADD COLUMN IF NOT EXISTS cantidad_ninos_max   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_adultos_max  INTEGER NOT NULL DEFAULT 0;

-- ── configuraciones ───────────────────────────────────────────────────────────
ALTER TABLE configuraciones
  ADD COLUMN IF NOT EXISTS precio_nino_adicional  NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_nino_adicional >= 0),
  ADD COLUMN IF NOT EXISTS precio_adulto_adicional NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_adulto_adicional >= 0);
