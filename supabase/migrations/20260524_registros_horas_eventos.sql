-- Junction table: links a registro_horas row to one or more eventos.
-- Allows tracking which events an employee worked on during a shift.
-- ON DELETE CASCADE ensures links are cleaned up when either side is deleted.

CREATE TABLE IF NOT EXISTS registros_horas_eventos (
  registro_id uuid NOT NULL REFERENCES registros_horas(id) ON DELETE CASCADE,
  evento_id   uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  PRIMARY KEY (registro_id, evento_id)
);

CREATE INDEX IF NOT EXISTS idx_rhe_registro ON registros_horas_eventos (registro_id);
CREATE INDEX IF NOT EXISTS idx_rhe_evento   ON registros_horas_eventos (evento_id);
