-- ============================================================
-- Escape Room module — TANDA 2: reservas + agenda
-- Builds on salas_escape / escape_config / escape_precios_persona
-- from 20260624_escape_room_base.sql. No payments/seña yet (tanda 3).
-- ============================================================

-- ------------------------------------------------------------
-- escape_contactos — separate from the birthday `clientes` table.
-- At least one of telefono/email is required, enforced at the API
-- level (not a DB constraint, to keep this table forgiving for
-- partial walk-in/phone bookings).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escape_contactos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  telefono   TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER escape_contactos_updated_at
  BEFORE UPDATE ON escape_contactos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE escape_contactos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON escape_contactos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- escape_reservas — one row per booked 90-min slot.
--
-- cantidad_personas is only bounded to a sane positive range here;
-- the 2..10 range required for modo_cobro = 'por_persona' (it maps
-- to escape_precios_persona) is enforced at the API level, since
-- 'sala_completa' bookings may legitimately exceed 10 people.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escape_reservas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id           UUID NOT NULL REFERENCES salas_escape(id) ON DELETE RESTRICT,
  contacto_id       UUID NOT NULL REFERENCES escape_contactos(id) ON DELETE RESTRICT,
  fecha             DATE NOT NULL,
  hora_inicio       TIME NOT NULL,
  cantidad_personas INTEGER NOT NULL CHECK (cantidad_personas > 0),
  modo_cobro        TEXT NOT NULL CHECK (modo_cobro IN ('por_persona', 'sala_completa')),
  precio_total      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_total >= 0),
  estado            TEXT NOT NULL DEFAULT 'reservada' CHECK (estado IN ('reservada', 'completada', 'cancelada')),
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast availability checks: "what's booked in sala X on date Y".
CREATE INDEX IF NOT EXISTS escape_reservas_sala_fecha_idx ON escape_reservas (sala_id, fecha);

CREATE TRIGGER escape_reservas_updated_at
  BEFORE UPDATE ON escape_reservas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE escape_reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON escape_reservas FOR ALL TO authenticated USING (true) WITH CHECK (true);
