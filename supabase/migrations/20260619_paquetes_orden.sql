-- Add display-order column to paquetes.
-- Existing rows are numbered sequentially by created_at so they don't collide at 0.
-- New rows default to 9999 (appear at the bottom until manually reordered via drag-drop).

ALTER TABLE paquetes
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 9999;

WITH ranked AS (
  SELECT id,
         (ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1) AS rn
  FROM paquetes
)
UPDATE paquetes
SET orden = ranked.rn
FROM ranked
WHERE paquetes.id = ranked.id;

CREATE INDEX IF NOT EXISTS paquetes_orden_idx ON paquetes (orden);
