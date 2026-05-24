-- Allow hora_salida to be NULL and relax the horas_trabajadas CHECK to >= 0.
-- The v2 registros-horas feature supports partial entries (hora_entrada only),
-- but migration 005_empleados_extension.sql defined both columns as NOT NULL
-- with horas_trabajadas CHECK > 0, causing the insert to fail at the DB level.

ALTER TABLE registros_horas
  ALTER COLUMN hora_salida DROP NOT NULL;

-- Replace the strict CHECK (horas_trabajadas > 0) with CHECK (>= 0)
-- so that partial entries (0 hours worked, no salida yet) are accepted.
ALTER TABLE registros_horas
  DROP CONSTRAINT IF EXISTS registros_horas_horas_trabajadas_check;

ALTER TABLE registros_horas
  ADD CONSTRAINT registros_horas_horas_trabajadas_check
  CHECK (horas_trabajadas >= 0);

-- Also drop the DB-level constraint that enforced hora_salida > hora_entrada,
-- since hora_salida can now be NULL.
ALTER TABLE registros_horas
  DROP CONSTRAINT IF EXISTS chk_hora_salida_gt_entrada;
