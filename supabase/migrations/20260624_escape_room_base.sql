-- ============================================================
-- Escape Room module — TANDA 1: database foundation
-- Independent module from the birthday Events module.
-- Reservations/payments are intentionally NOT part of this migration.
-- ============================================================

-- ------------------------------------------------------------
-- salas_escape — the two physical rooms
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salas_escape (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  activa     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO salas_escape (nombre)
SELECT nombre FROM (VALUES ('Qué pasó ayer'), ('El Conjuro')) AS seed(nombre)
WHERE NOT EXISTS (SELECT 1 FROM salas_escape);

ALTER TABLE salas_escape ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON salas_escape FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- escape_config — single-row global config (singleton via fixed id)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escape_config (
  id                        INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hora_inicio_reservas      TIME NOT NULL DEFAULT '18:00',
  hora_fin_reservas         TIME NOT NULL DEFAULT '23:00',
  duracion_bloque_min       INTEGER NOT NULL DEFAULT 90 CHECK (duracion_bloque_min > 0),
  sena_minima               NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (sena_minima >= 0),
  recargo_transferencia_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (recargo_transferencia_pct >= 0),
  precio_sala_completa      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_sala_completa >= 0),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO escape_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER escape_config_updated_at
  BEFORE UPDATE ON escape_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE escape_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON escape_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- escape_precios_persona — per-person price by group size (2..10)
--
-- sala_id is nullable and unused for now: every row today is global
-- (sala_id IS NULL), with `cantidad` as the unique key so Supabase's
-- upsert(onConflict: "cantidad") works directly. A future tanda that adds
-- room-specific pricing would replace the plain UNIQUE(cantidad) below
-- with UNIQUE(sala_id, cantidad) (treating NULL as "applies to all
-- rooms" in the lookup logic) — an additive migration, not a rewrite.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escape_precios_persona (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id            UUID REFERENCES salas_escape(id) ON DELETE CASCADE,
  cantidad           INTEGER NOT NULL CHECK (cantidad BETWEEN 2 AND 10),
  precio_por_persona NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_por_persona >= 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cantidad)
);

INSERT INTO escape_precios_persona (sala_id, cantidad, precio_por_persona)
SELECT NULL, n, 0
FROM generate_series(2, 10) AS n
WHERE NOT EXISTS (SELECT 1 FROM escape_precios_persona WHERE cantidad = n);

CREATE TRIGGER escape_precios_persona_updated_at
  BEFORE UPDATE ON escape_precios_persona
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE escape_precios_persona ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON escape_precios_persona FOR ALL TO authenticated USING (true) WITH CHECK (true);
