-- Backfill de prefix y number para ventas que tienen number NULL.
-- Asigna prefijo 'FV' y números secuenciales por fecha de creación (created_at),
-- empezando después del máximo number actual para no pisar numeración existente.
-- Requiere MySQL 8+ (usa ROW_NUMBER).

-- 1) Siguiente número a usar (después del máximo actual para prefix 'FV')
SET @next_num = (SELECT COALESCE(MAX(number), 0) FROM sales WHERE prefix = 'FV');

-- 2) Actualizar solo filas con number NULL, ordenadas por created_at
UPDATE sales s
INNER JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM sales
  WHERE number IS NULL
) t ON s.id = t.id
SET
  s.prefix = 'FV',
  s.number = @next_num + t.rn;

-- Ver cuántas filas se actualizaron (ejecutar después del UPDATE si quieres)
-- SELECT ROW_COUNT() AS rows_updated;
