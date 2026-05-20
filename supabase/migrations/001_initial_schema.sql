-- ============================================================
-- EventOS — Initial Schema
-- ============================================================

-- Trigger function to auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- usuarios (extends Supabase auth.users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre    TEXT NOT NULL,
  rol       TEXT NOT NULL DEFAULT 'staff' CHECK (rol IN ('admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  descripcion  TEXT,
  categoria    TEXT NOT NULL DEFAULT 'general'
               CHECK (categoria IN ('actividad', 'comida', 'bebida', 'decoracion', 'general')),
  unidad       TEXT NOT NULL DEFAULT 'unidad',
  es_activo    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- paquetes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paquetes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  precio          NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
  duracion_horas  INTEGER NOT NULL DEFAULT 2 CHECK (duracion_horas > 0),
  max_invitados   INTEGER NOT NULL DEFAULT 20 CHECK (max_invitados > 0),
  es_activo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER paquetes_updated_at
  BEFORE UPDATE ON paquetes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- paquete_items (junction)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paquete_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paquete_id  UUID NOT NULL REFERENCES paquetes(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  cantidad    INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  UNIQUE (paquete_id, item_id)
);

-- ------------------------------------------------------------
-- promociones
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promociones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  descripcion      TEXT,
  tipo_descuento   TEXT NOT NULL CHECK (tipo_descuento IN ('porcentaje', 'monto_fijo')),
  valor_descuento  NUMERIC(10, 2) NOT NULL CHECK (valor_descuento > 0),
  fecha_inicio     DATE NOT NULL,
  fecha_fin        DATE,
  es_activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            TEXT NOT NULL,
  telefono          TEXT,
  email             TEXT,
  fecha_cumpleanos  DATE,
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- eventos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  paquete_id       UUID NOT NULL REFERENCES paquetes(id) ON DELETE RESTRICT,
  promocion_id     UUID REFERENCES promociones(id) ON DELETE SET NULL,
  fecha_evento     TIMESTAMPTZ NOT NULL,
  nombre_festejado TEXT NOT NULL,
  edad_festejado   INTEGER,
  num_invitados    INTEGER NOT NULL DEFAULT 0 CHECK (num_invitados >= 0),
  estado           TEXT NOT NULL DEFAULT 'cotizacion'
                   CHECK (estado IN ('cotizacion', 'confirmado', 'en_curso', 'completado', 'cancelado')),
  precio_total     NUMERIC(10, 2) NOT NULL CHECK (precio_total >= 0),
  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER eventos_updated_at
  BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- pagos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  monto       NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
  metodo      TEXT NOT NULL DEFAULT 'efectivo'
              CHECK (metodo IN ('efectivo', 'tarjeta', 'transferencia')),
  fecha_pago  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- empleados
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT NOT NULL,
  telefono       TEXT,
  email          TEXT,
  rol            TEXT NOT NULL DEFAULT 'staff',
  salario_hora   NUMERIC(10, 2) CHECK (salario_hora >= 0),
  es_activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER empleados_updated_at
  BEFORE UPDATE ON empleados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- evento_empleados (junction)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_empleados (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id        UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  empleado_id      UUID NOT NULL REFERENCES empleados(id) ON DELETE RESTRICT,
  horas_trabajadas NUMERIC(4, 1) CHECK (horas_trabajadas >= 0),
  UNIQUE (evento_id, empleado_id)
);

-- ------------------------------------------------------------
-- movimientos_caja
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_caja (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  categoria    TEXT NOT NULL,
  monto        NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
  descripcion  TEXT,
  evento_id    UUID REFERENCES eventos(id) ON DELETE SET NULL,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- recordatorios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recordatorios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   UUID REFERENCES eventos(id) ON DELETE CASCADE,
  cliente_id  UUID REFERENCES clientes(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('whatsapp', 'email', 'sms')),
  mensaje     TEXT NOT NULL,
  fecha_envio TIMESTAMPTZ NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'pendiente'
              CHECK (estado IN ('pendiente', 'enviado', 'fallido')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------
ALTER TABLE usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquetes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquete_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE promociones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados        ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordatorios    ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write all rows (server-side auth via service key bypasses RLS)
CREATE POLICY "auth_all" ON items            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON paquetes         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON paquete_items    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON promociones      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON clientes         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON eventos          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON pagos            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON empleados        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON evento_empleados FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON movimientos_caja FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON recordatorios    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "own_row"  ON usuarios         FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
