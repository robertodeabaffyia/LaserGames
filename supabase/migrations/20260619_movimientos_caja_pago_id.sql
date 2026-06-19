-- Link auto-created movimientos_caja rows to their source pagos row so that
-- deleting or editing a payment can find and update the paired cash-movement
-- entry exactly (no fuzzy matching on amount / description).
--
-- ON DELETE SET NULL: the cash entry stays visible if the pago is deleted
-- via a direct DB operation; application code (DELETE /api/pagos/[id]) handles
-- the explicit removal before the pago delete. Old rows that predate this
-- migration keep pago_id = NULL and are unaffected.

ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS pago_id UUID REFERENCES pagos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS movimientos_caja_pago_id_idx ON movimientos_caja (pago_id);
