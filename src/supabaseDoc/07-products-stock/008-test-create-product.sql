-- ===========================================================
-- PRUEBA MANUAL DE CREACIÓN DE PRODUCTO
-- ===========================================================
-- Ejecuta este script para probar si la función funciona

-- ========================================
-- 1. VERIFICAR USUARIO ACTUAL Y CLUB
-- ========================================

DO $$
DECLARE
  v_user_id uuid;
  v_club_id uuid;
  v_admin_exists boolean;
BEGIN
  -- Usuario actual
  v_user_id := auth.uid();

  -- Club del admin
  v_club_id := fn_current_admin_club_id();

  -- Verificar si el usuario es admin
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = v_user_id
  ) INTO v_admin_exists;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INFO DEL USUARIO ACTUAL';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Club ID: %', v_club_id;
  RAISE NOTICE 'Es admin: %', CASE WHEN v_admin_exists THEN 'SÍ' ELSE 'NO' END;

  IF v_club_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: No tienes un club asignado';
  ELSE
    RAISE NOTICE '✓ Todo correcto';
  END IF;
END$$;

-- ========================================
-- 2. PROBAR CREAR PRODUCTO CON CATEGORÍA NUEVA
-- ========================================

-- Test 1: Vino
SELECT create_product_with_stock(
  'Vino Malbec TEST',
  'vinos',
  500.00,
  1200.00,
  12,
  'Vino tinto de prueba',
  'Test Brand',
  'TEST-VIN-001',
  'bottle',
  6
) as producto_id_vino;

-- Test 2: Cerveza
SELECT create_product_with_stock(
  'Cerveza Corona TEST',
  'cervezas',
  250.00,
  800.00,
  24,
  'Cerveza de prueba',
  'Corona',
  'TEST-CER-001',
  'bottle',
  12
) as producto_id_cerveza;

-- Test 3: Coctel
SELECT create_product_with_stock(
  'Mojito TEST',
  'cocteles',
  300.00,
  1000.00,
  0,
  'Coctel de prueba',
  NULL,
  'TEST-COC-001',
  'glass',
  0
) as producto_id_coctel;

-- Test 4: Otros (categoría por defecto)
SELECT create_product_with_stock(
  'Producto Genérico TEST',
  'otros',
  100.00,
  300.00,
  10,
  'Producto de prueba',
  NULL,
  'TEST-OTR-001',
  'unit',
  5
) as producto_id_otros;

-- ========================================
-- 3. VERIFICAR QUE SE CREARON
-- ========================================

SELECT
  p.id,
  p.name,
  p.category,
  p.cost_price,
  p.sale_price,
  ps.current_stock,
  ps.available_stock
FROM public.products p
LEFT JOIN public.product_stock ps ON ps.product_id = p.id
WHERE p.name LIKE '%TEST%'
ORDER BY p.created_at DESC;

-- ========================================
-- 4. LIMPIAR PRODUCTOS DE PRUEBA (OPCIONAL)
-- ========================================

/*
-- Descomenta esto si quieres eliminar los productos de prueba
DELETE FROM public.products WHERE name LIKE '%TEST%';
*/

-- ========================================
-- 5. VER TODOS LOS PRODUCTOS
-- ========================================

SELECT * FROM products_with_stock ORDER BY created_at DESC LIMIT 10;
