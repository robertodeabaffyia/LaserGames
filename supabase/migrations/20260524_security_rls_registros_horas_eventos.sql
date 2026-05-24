-- Enable RLS on the registros_horas_eventos junction table.
-- This table was created without RLS in migration 20260524_registros_horas_eventos.sql.
-- Without RLS the table was governed solely by PostgreSQL table-level grants,
-- which allows direct Supabase API access with the anon key.

ALTER TABLE registros_horas_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON registros_horas_eventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
