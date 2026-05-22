-- ============================================================
-- EventOS — Migration 006: add colegio to hijos
-- ============================================================

ALTER TABLE hijos
  ADD COLUMN IF NOT EXISTS colegio TEXT;
