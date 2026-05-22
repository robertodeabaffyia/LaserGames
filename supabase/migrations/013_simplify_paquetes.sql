-- ── 013_simplify_paquetes.sql ────────────────────────────────────────────────
-- Remove capacity-max columns; keep only the included-count columns.

ALTER TABLE paquetes
  DROP COLUMN IF EXISTS cantidad_ninos_max,
  DROP COLUMN IF EXISTS cantidad_adultos_max;
