-- ============================================================
-- EventOS — Migration 007: movimientos_caja + bonos_empleados
-- ============================================================

-- Create table if it doesn't exist yet (fresh installs)
CREATE TABLE IF NOT EXISTS movimientos_caja (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  categoria             TEXT NOT NULL,
  descripcion           TEXT,
  monto                 NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
  es_repetible          BOOLEAN NOT NULL DEFAULT false,
  frecuencia_repeticion TEXT CHECK (frecuencia_repeticion IN ('mensual', 'semanal')),
  evento_id             UUID REFERENCES eventos(id) ON DELETE SET NULL,
  empleado_id           UUID REFERENCES empleados(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns that may be missing if table already existed from migration 001
ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS usuario_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS es_repetible          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frecuencia_repeticion TEXT CHECK (frecuencia_repeticion IN ('mensual', 'semanal')),
  ADD COLUMN IF NOT EXISTS empleado_id           UUID REFERENCES empleados(id) ON DELETE SET NULL;

ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON movimientos_caja
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS movimientos_caja_fecha_idx       ON movimientos_caja (fecha);
CREATE INDEX IF NOT EXISTS movimientos_caja_tipo_idx        ON movimientos_caja (tipo);
CREATE INDEX IF NOT EXISTS movimientos_caja_categoria_idx   ON movimientos_caja (categoria);
CREATE INDEX IF NOT EXISTS movimientos_caja_evento_id_idx   ON movimientos_caja (evento_id);
CREATE INDEX IF NOT EXISTS movimientos_caja_empleado_id_idx ON movimientos_caja (empleado_id);

-- ── bonos_empleados ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bonos_empleados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  mes         TEXT NOT NULL CHECK (mes ~ '^\d{4}-\d{2}$'),
  monto_bono  NUMERIC(10, 2) NOT NULL CHECK (monto_bono > 0),
  descripcion TEXT,
  creado_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bonos_empleados ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON bonos_empleados
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS bonos_empleados_empleado_mes_idx ON bonos_empleados (empleado_id, mes);
