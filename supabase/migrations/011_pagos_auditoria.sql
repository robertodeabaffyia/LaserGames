-- ── 011_pagos_auditoria.sql ──────────────────────────────────────────────────
-- Audit table for pago changes + quien_recibio column on pagos

-- Add quien_recibio to existing pagos table
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS quien_recibio TEXT NULL;

-- ── Audit table ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pagos_auditoria (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id     UUID        NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
  accion      TEXT        NOT NULL CHECK (accion IN ('crear', 'editar', 'eliminar')),
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  cambios     JSONB       NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE pagos_auditoria ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all" ON pagos_auditoria
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Trigger: auto-capture pago mutations ──────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_pagos_auditoria()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO pagos_auditoria (pago_id, accion, usuario_id, cambios)
    VALUES (NEW.id, 'crear', auth.uid(), to_jsonb(NEW));

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO pagos_auditoria (pago_id, accion, usuario_id, cambios)
    VALUES (
      NEW.id, 'editar', auth.uid(),
      jsonb_build_object('antes', to_jsonb(OLD), 'despues', to_jsonb(NEW))
    );

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO pagos_auditoria (pago_id, accion, usuario_id, cambios)
    VALUES (OLD.id, 'eliminar', auth.uid(), to_jsonb(OLD));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pagos_auditoria ON pagos;

CREATE TRIGGER trg_pagos_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON pagos
  FOR EACH ROW EXECUTE FUNCTION fn_pagos_auditoria();
