-- Fix the `usuarios` table rol CHECK constraint.
-- The initial schema had CHECK (rol IN ('admin', 'staff')) but the application
-- uses UsuarioRol = 'admin' | 'supervisor' | 'general'.
-- This migration aligns the DB constraint with the TypeScript type.

-- Drop old constraint if it exists (name may vary)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

-- Re-add with the correct set of values
ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('admin', 'supervisor', 'general'));

-- Migrate any legacy 'staff' rows to 'general' before the constraint is applied
UPDATE usuarios SET rol = 'general' WHERE rol NOT IN ('admin', 'supervisor', 'general');
