-- ============================================================
-- EventOS — Add precio_nino_adicional and precio_adulto_adicional
--           to configuraciones table
-- ============================================================

ALTER TABLE configuraciones
  ADD COLUMN IF NOT EXISTS precio_nino_adicional   NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_nino_adicional >= 0),
  ADD COLUMN IF NOT EXISTS precio_adulto_adicional NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_adulto_adicional >= 0);

COMMENT ON COLUMN configuraciones.precio_nino_adicional   IS 'Price per child above paquete.cantidad_ninos_incluidos';
COMMENT ON COLUMN configuraciones.precio_adulto_adicional IS 'Price per adult above paquete.cantidad_adultos_incluidos';
