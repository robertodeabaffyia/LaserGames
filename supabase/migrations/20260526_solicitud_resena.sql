-- ============================================================
-- EventOS — Solicitud de reseña automática
-- ============================================================

-- 1. Add solicitud_resena to cliente_desuscripciones CHECK
ALTER TABLE cliente_desuscripciones
  DROP CONSTRAINT IF EXISTS cliente_desuscripciones_tipo_notificacion_check;

ALTER TABLE cliente_desuscripciones
  ADD CONSTRAINT cliente_desuscripciones_tipo_notificacion_check
  CHECK (tipo_notificacion IN (
    'evento_recordatorio',
    'promocion_cumpleanos',
    'confirmacion_evento',
    'campania_cumpleanos',
    'solicitud_resena'
  ));

-- 2. Add google_maps_url to configuraciones
ALTER TABLE configuraciones
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

COMMENT ON COLUMN configuraciones.google_maps_url IS
  'Direct link to the Google Maps review page for this business';
