-- ============================================================
-- EventOS — Migration 002: hijos table
-- ============================================================

CREATE TABLE IF NOT EXISTS hijos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER hijos_updated_at
  BEFORE UPDATE ON hijos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE hijos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON hijos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index for fast lookup of children by client
CREATE INDEX IF NOT EXISTS hijos_cliente_id_idx ON hijos (cliente_id);

-- Index for birthday queries (month + day)
CREATE INDEX IF NOT EXISTS hijos_fecha_nacimiento_idx ON hijos (fecha_nacimiento);
CREATE INDEX IF NOT EXISTS clientes_fecha_cumpleanos_idx ON clientes (fecha_cumpleanos);
