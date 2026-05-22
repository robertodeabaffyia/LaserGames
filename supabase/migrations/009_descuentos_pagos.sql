-- Add discount fields to pagos table
ALTER TABLE pagos
  ADD COLUMN tiene_descuento boolean NOT NULL DEFAULT false,
  ADD COLUMN tipo_descuento  text    CHECK (tipo_descuento IN ('porcentaje', 'monto')),
  ADD COLUMN valor_descuento numeric(10, 2),
  ADD COLUMN monto_final     numeric(10, 2);

-- monto_final = NULL means no discount applied (backward-compatible: treat as monto)
-- tipo_descuento and valor_descuento are NULL when tiene_descuento = false

COMMENT ON COLUMN pagos.monto          IS 'Base amount before discount';
COMMENT ON COLUMN pagos.monto_final    IS 'Effective credited amount after discount; NULL = same as monto';
COMMENT ON COLUMN pagos.tipo_descuento IS 'porcentaje | monto';
COMMENT ON COLUMN pagos.valor_descuento IS 'Discount value (% or fixed $)';
