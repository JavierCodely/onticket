-- ===========================================================
-- DIAGNÓSTICO COMPLETO DEL SISTEMA DE PRODUCTOS
-- ===========================================================
-- Ejecuta este script para ver exactamente qué está mal

-- ========================================
-- 1. VERIFICAR CATEGORÍAS
-- ========================================

SELECT
  '1. CATEGORÍAS' as seccion,
  enumlabel as categoria
FROM pg_enum
WHERE enumtypid = 'product_category'::regtype
ORDER BY enumlabel;

-- ========================================
-- 2. VERIFICAR ESTRUCTURA DE TABLA PRODUCTS
-- ========================================

SELECT
  '2. COLUMNAS DE PRODUCTS' as seccion,
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
ORDER BY ordinal_position;

-- ========================================
-- 3. VERIFICAR FUNCIÓN create_product_with_stock
-- ========================================

SELECT
  '3. FUNCIÓN create_product_with_stock' as seccion,
  p.proname as nombre_funcion,
  pg_get_function_arguments(p.oid) as argumentos,
  pg_get_functiondef(p.oid) as definicion_completa
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'create_product_with_stock';

-- ========================================
-- 4. VERIFICAR POLÍTICAS RLS DE PRODUCTS
-- ========================================

SELECT
  '4. POLÍTICAS RLS - PRODUCTS' as seccion,
  pol.polname as nombre_politica,
  pol.polcmd as comando,
  CASE pol.polpermissive
    WHEN true THEN 'PERMISSIVE'
    ELSE 'RESTRICTIVE'
  END as tipo,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
JOIN pg_class pc ON pol.polrelid = pc.oid
JOIN pg_namespace pn ON pc.relnamespace = pn.oid
WHERE pn.nspname = 'public'
  AND pc.relname = 'products'
ORDER BY pol.polname;

-- ========================================
-- 5. VERIFICAR POLÍTICAS RLS DE PRODUCT_STOCK
-- ========================================

SELECT
  '5. POLÍTICAS RLS - PRODUCT_STOCK' as seccion,
  pol.polname as nombre_politica,
  pol.polcmd as comando,
  CASE pol.polpermissive
    WHEN true THEN 'PERMISSIVE'
    ELSE 'RESTRICTIVE'
  END as tipo,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
JOIN pg_class pc ON pol.polrelid = pc.oid
JOIN pg_namespace pn ON pc.relnamespace = pn.oid
WHERE pn.nspname = 'public'
  AND pc.relname = 'product_stock'
ORDER BY pol.polname;

-- ========================================
-- 6. VERIFICAR FUNCIÓN fn_current_admin_club_id
-- ========================================

SELECT
  '6. FUNCIÓN fn_current_admin_club_id' as seccion,
  p.proname as nombre_funcion,
  pg_get_functiondef(p.oid) as definicion
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'fn_current_admin_club_id';

-- ========================================
-- 7. VERIFICAR ADMINS Y CLUBS
-- ========================================

SELECT
  '7. ADMINS Y CLUBS' as seccion,
  a.id as admin_id,
  a.user_id,
  a.club_id,
  c.name as club_name,
  a.status as admin_status,
  c.status as club_status
FROM public.admins a
JOIN public.clubs c ON c.id = a.club_id;

-- ========================================
-- 8. VERIFICAR PRODUCTOS EXISTENTES
-- ========================================

SELECT
  '8. PRODUCTOS EXISTENTES' as seccion,
  COUNT(*) as total_productos
FROM public.products;

SELECT
  '8b. PRODUCTOS POR CATEGORÍA' as seccion,
  category,
  COUNT(*) as cantidad
FROM public.products
GROUP BY category
ORDER BY category;

-- ========================================
-- 9. PROBAR CREAR PRODUCTO (SIMULACIÓN)
-- ========================================

-- Esta consulta solo verifica que la función existe y se puede llamar
-- NO CREA REALMENTE EL PRODUCTO, solo muestra información
SELECT
  '9. SIMULACIÓN DE CREACIÓN' as seccion,
  'La función existe y acepta estos parámetros:' as info,
  pg_get_function_arguments(p.oid) as parametros
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'create_product_with_stock';

-- ========================================
-- 10. VERIFICAR VISTA products_with_stock
-- ========================================

SELECT
  '10. VISTA products_with_stock' as seccion,
  pg_get_viewdef('public.products_with_stock'::regclass, true) as definicion;

-- ========================================
-- RESUMEN FINAL
-- ========================================

DO $$
DECLARE
  v_categories_count integer;
  v_function_exists boolean;
  v_products_count integer;
  v_admins_count integer;
  v_policies_products integer;
  v_policies_stock integer;
BEGIN
  -- Contar categorías
  SELECT COUNT(*) INTO v_categories_count
  FROM pg_enum
  WHERE enumtypid = 'product_category'::regtype;

  -- Verificar función
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'create_product_with_stock'
  ) INTO v_function_exists;

  -- Contar productos
  SELECT COUNT(*) INTO v_products_count FROM public.products;

  -- Contar admins
  SELECT COUNT(*) INTO v_admins_count FROM public.admins;

  -- Contar políticas
  SELECT COUNT(*) INTO v_policies_products
  FROM pg_policy pol
  JOIN pg_class pc ON pol.polrelid = pc.oid
  WHERE pc.relname = 'products';

  SELECT COUNT(*) INTO v_policies_stock
  FROM pg_policy pol
  JOIN pg_class pc ON pol.polrelid = pc.oid
  WHERE pc.relname = 'product_stock';

  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════╗';
  RAISE NOTICE '║      RESUMEN DEL DIAGNÓSTICO               ║';
  RAISE NOTICE '╠════════════════════════════════════════════╣';
  RAISE NOTICE '║ Categorías: %                             ║', LPAD(v_categories_count::text, 2);
  RAISE NOTICE '║ Función create_product: %                 ║', CASE WHEN v_function_exists THEN 'SÍ' ELSE 'NO' END;
  RAISE NOTICE '║ Productos existentes: %                   ║', LPAD(v_products_count::text, 3);
  RAISE NOTICE '║ Admins registrados: %                     ║', LPAD(v_admins_count::text, 3);
  RAISE NOTICE '║ Políticas en products: %                  ║', LPAD(v_policies_products::text, 2);
  RAISE NOTICE '║ Políticas en product_stock: %             ║', LPAD(v_policies_stock::text, 2);
  RAISE NOTICE '╚════════════════════════════════════════════╝';
  RAISE NOTICE '';

  IF v_categories_count != 10 THEN
    RAISE NOTICE '❌ ERROR: Deberían haber 10 categorías';
  END IF;

  IF NOT v_function_exists THEN
    RAISE NOTICE '❌ ERROR: La función create_product_with_stock NO EXISTE';
  END IF;

  IF v_policies_products < 5 THEN
    RAISE NOTICE '⚠️  ADVERTENCIA: Pocas políticas en products (esperadas: 5 o más)';
  END IF;

  IF v_policies_stock < 5 THEN
    RAISE NOTICE '⚠️  ADVERTENCIA: Pocas políticas en product_stock (esperadas: 5 o más)';
  END IF;
END$$;
