-- ===========================================================
-- FIX COMPLETO: ACTUALIZACIÓN DE CATEGORÍAS DE PRODUCTOS
-- ===========================================================
-- Este script actualiza correctamente las categorías de productos
-- sin romper los datos existentes

-- PASO 1: Crear el nuevo tipo con todas las categorías
DO $$
BEGIN
  -- Crear un nuevo tipo temporal con todas las categorías
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category_new') THEN
    CREATE TYPE product_category_new AS ENUM (
      'vinos',
      'cervezas',
      'cocteles',
      'vodka',
      'bebidas_alcoholicas',
      'bebidas_sin_alcohol',
      'comida',
      'cigarrillos',
      'merchandising',
      'otros'
    );
  END IF;
END$$;

-- PASO 2: Agregar columna temporal con el nuevo tipo
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_new product_category_new;

-- PASO 3: Migrar datos de la columna vieja a la nueva
UPDATE public.products
SET category_new = category::text::product_category_new;

-- PASO 4: Eliminar la columna vieja
ALTER TABLE public.products DROP COLUMN IF EXISTS category;

-- PASO 5: Renombrar la columna nueva
ALTER TABLE public.products RENAME COLUMN category_new TO category;

-- PASO 6: Agregar NOT NULL constraint
ALTER TABLE public.products
  ALTER COLUMN category SET NOT NULL;

-- PASO 7: Eliminar el tipo viejo y renombrar el nuevo
DROP TYPE IF EXISTS product_category CASCADE;
ALTER TYPE product_category_new RENAME TO product_category;

-- PASO 8: Recrear la vista products_with_stock
DROP VIEW IF EXISTS public.products_with_stock CASCADE;
CREATE OR REPLACE VIEW public.products_with_stock AS
SELECT
  p.*,
  COALESCE(ps.current_stock, 0) as current_stock,
  COALESCE(ps.reserved_stock, 0) as reserved_stock,
  COALESCE(ps.available_stock, 0) as available_stock,
  CASE
    WHEN COALESCE(ps.available_stock, 0) <= p.min_stock THEN true
    ELSE false
  END as is_low_stock,
  ps.last_restock_date,
  ps.last_sale_date
FROM public.products p
LEFT JOIN public.product_stock ps ON ps.product_id = p.id;

-- PASO 9: Restaurar RLS en la vista
ALTER VIEW public.products_with_stock SET (security_invoker = on);

-- PASO 10: Comentarios descriptivos
COMMENT ON TYPE product_category IS 'Categorías de productos del club';
COMMENT ON COLUMN products.category IS 'Categoría del producto (vinos, cervezas, cocteles, vodka, bebidas_alcoholicas, bebidas_sin_alcohol, comida, cigarrillos, merchandising, otros)';

-- PASO 11: Verificación
DO $$
DECLARE
  v_count integer;
BEGIN
  -- Contar productos
  SELECT COUNT(*) INTO v_count FROM public.products;
  RAISE NOTICE 'Total de productos después de la migración: %', v_count;

  -- Mostrar distribución por categoría
  RAISE NOTICE 'Distribución por categoría:';
  FOR v_count IN
    SELECT category::text || ': ' || COUNT(*)::text
    FROM public.products
    GROUP BY category
    ORDER BY category
  LOOP
    RAISE NOTICE '%', v_count;
  END LOOP;
END$$;

/*
===========================================================
VERIFICACIÓN POST-MIGRACIÓN
===========================================================

-- 1. Verificar que el tipo existe correctamente
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'product_category'::regtype
ORDER BY enumlabel;

-- 2. Ver todos los productos con sus categorías
SELECT id, name, category, status
FROM products
ORDER BY category, name;

-- 3. Verificar la vista
SELECT * FROM products_with_stock LIMIT 5;

-- 4. Probar crear un producto con nueva categoría
INSERT INTO products (
  club_id,
  name,
  category,
  cost_price,
  sale_price,
  unit,
  created_by
) VALUES (
  fn_current_admin_club_id(),
  'Vino Malbec Tinto',
  'vinos',
  500.00,
  1200.00,
  'bottle',
  auth.uid()
);

===========================================================
CATEGORÍAS DISPONIBLES
===========================================================

Bebidas Alcohólicas Específicas:
✓ vinos          - Vinos (tinto, blanco, rosado, espumante)
✓ cervezas       - Cervezas (nacionales e importadas)
✓ cocteles       - Cocteles preparados (mojito, caipirinha, etc.)
✓ vodka          - Vodka y derivados

Categorías Generales:
✓ bebidas_alcoholicas    - Otras bebidas (whisky, ron, gin, etc.)
✓ bebidas_sin_alcohol    - Gaseosas, agua, jugos
✓ comida                 - Comidas y snacks
✓ cigarrillos           - Cigarrillos y tabaco
✓ merchandising         - Productos del club
✓ otros                 - Otros productos

*/
