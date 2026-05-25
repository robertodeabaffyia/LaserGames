-- ============================================================
-- EventOS — Add campania_cumpleanos to cliente_desuscripciones
-- ============================================================

-- Extend the tipo_notificacion CHECK constraint to include the new campaign type.
-- We must drop the old constraint and recreate it.

ALTER TABLE cliente_desuscripciones
  DROP CONSTRAINT IF EXISTS cliente_desuscripciones_tipo_notificacion_check;

ALTER TABLE cliente_desuscripciones
  ADD CONSTRAINT cliente_desuscripciones_tipo_notificacion_check
  CHECK (tipo_notificacion IN (
    'evento_recordatorio',
    'promocion_cumpleanos',
    'confirmacion_evento',
    'campania_cumpleanos'
  ));

COMMENT ON COLUMN cliente_desuscripciones.tipo_notificacion IS
  'Notification type: evento_recordatorio | promocion_cumpleanos | confirmacion_evento | campania_cumpleanos';
