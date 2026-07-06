-- ============================================================
-- Reservas de cumpleaños por WhatsApp + seña vía Mercado Pago
-- Reusa el modulo de eventos/pagos existente: el bot crea un evento
-- en estado 'pendiente' y, cuando MP acredita la seña, el webhook
-- registra un pago (metodo 'mercadopago') que dispara la confirmacion
-- via recalcularEstadoEvento (evento -> 'confirmado').
-- ============================================================

-- ------------------------------------------------------------
-- pagos.metodo: agregar 'mercadopago' como medio de pago valido
-- ------------------------------------------------------------
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_check
  CHECK (metodo IN ('efectivo', 'tarjeta', 'transferencia', 'mercadopago'));

-- ------------------------------------------------------------
-- eventos: tracking de origen (manual/whatsapp) y de la seña por MP.
-- El estado y el saldo se siguen calculando desde la tabla `pagos`
-- (recalcularEstadoEvento); estas columnas son solo para trazabilidad
-- y para que el webhook de MP encuentre el evento por external_reference.
-- ------------------------------------------------------------
ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS origen           TEXT NOT NULL DEFAULT 'manual'
    CHECK (origen IN ('manual', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS sena_monto       NUMERIC(10, 2) CHECK (sena_monto >= 0),
  ADD COLUMN IF NOT EXISTS mp_preference_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_payment_id    TEXT;
