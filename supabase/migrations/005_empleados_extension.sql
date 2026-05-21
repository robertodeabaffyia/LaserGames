-- ============================================================
-- EventOS — Empleados Extension + Registros de Horas
-- ============================================================

-- Add missing columns to existing empleados table
ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS dni                TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS fecha_contratacion DATE,
  ADD COLUMN IF NOT EXISTS tarifa_horaria     NUMERIC(10, 2) CHECK (tarifa_horaria >= 0);

-- Extend rol CHECK to proper employee roles
-- (original table had no CHECK, just a DEFAULT of 'staff')
ALTER TABLE empleados DROP CONSTRAINT IF EXISTS empleados_rol_check;
ALTER TABLE empleados ADD CONSTRAINT empleados_rol_check
  CHECK (rol IN ('administrador', 'supervisor', 'general'));

-- Normalise existing rows that may have rol='staff' before the constraint is applied
-- (safe for dev environments; in prod, run a data migration first)
UPDATE empleados SET rol = 'general' WHERE rol NOT IN ('administrador', 'supervisor', 'general');

-- Index for search by dni / name
CREATE INDEX IF NOT EXISTS idx_empleados_dni    ON empleados (dni);
CREATE INDEX IF NOT EXISTS idx_empleados_nombre ON empleados (nombre);

-- ------------------------------------------------------------
-- registros_horas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registros_horas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id      UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  fecha            DATE NOT NULL,
  hora_entrada     TIME NOT NULL,
  hora_salida      TIME NOT NULL,
  horas_trabajadas NUMERIC(4, 2) NOT NULL CHECK (horas_trabajadas > 0),
  notas            TEXT,
  creado_por       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- DB-level guarantee: salida must be after entrada
  CONSTRAINT chk_hora_salida_gt_entrada CHECK (hora_salida > hora_entrada)
);

CREATE INDEX IF NOT EXISTS idx_registros_horas_empleado ON registros_horas (empleado_id);
CREATE INDEX IF NOT EXISTS idx_registros_horas_fecha    ON registros_horas (fecha);

ALTER TABLE registros_horas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users manage registros_horas"
  ON registros_horas FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users manage empleados"
  ON empleados FOR ALL USING (auth.role() = 'authenticated');
