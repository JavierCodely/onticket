-- ===========================================================
-- 🔧 HABILITAR REAL-TIME PARA PRODUCTOS Y STOCK
-- ===========================================================
-- OBJETIVO: Empleados ven actualizaciones de stock en tiempo real
-- cuando admins modifican inventario

-- ========================================
-- PASO 1: AGREGAR TABLAS A REALTIME (SEGURO)
-- ========================================

DO $$
BEGIN
  -- Agregar products si no está
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    RAISE NOTICE '✅ Tabla products agregada a supabase_realtime';
  ELSE
    RAISE NOTICE '✅ Tabla products ya está en supabase_realtime';
  END IF;

  -- Agregar product_stock si no está
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'product_stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_stock;
    RAISE NOTICE '✅ Tabla product_stock agregada a supabase_realtime';
  ELSE
    RAISE NOTICE '✅ Tabla product_stock ya está en supabase_realtime';
  END IF;

  -- Agregar products_with_stock vista si no está (algunos clientes lo soportan)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'products_with_stock'
    ) THEN
      -- Intentar agregar la vista (puede fallar en algunas versiones)
      ALTER PUBLICATION supabase_realtime ADD TABLE public.products_with_stock;
      RAISE NOTICE '✅ Vista products_with_stock agregada a supabase_realtime';
    ELSE
      RAISE NOTICE '✅ Vista products_with_stock ya está en supabase_realtime';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ No se pudo agregar vista products_with_stock a realtime (normal en algunas versiones)';
  END;
END$$;

-- ========================================
-- PASO 2: CONFIGURAR REPLICA IDENTITY
-- ========================================

DO $$
BEGIN
  -- Products table
  IF (SELECT pg_class.relreplident FROM pg_class WHERE relname = 'products') != 'd' THEN
    ALTER TABLE public.products REPLICA IDENTITY DEFAULT;
    RAISE NOTICE '✅ Replica identity configurada para products';
  ELSE
    RAISE NOTICE '✅ Replica identity ya está configurada para products';
  END IF;

  -- Product_stock table
  IF (SELECT pg_class.relreplident FROM pg_class WHERE relname = 'product_stock') != 'd' THEN
    ALTER TABLE public.product_stock REPLICA IDENTITY DEFAULT;
    RAISE NOTICE '✅ Replica identity configurada para product_stock';
  ELSE
    RAISE NOTICE '✅ Replica identity ya está configurada para product_stock';
  END IF;
END$$;

-- ========================================
-- PASO 3: POLÍTICAS RLS PARA REAL-TIME DE PRODUCTOS
-- ========================================

-- Política para que empleados puedan "escuchar" cambios en productos de su club
DROP POLICY IF EXISTS products_realtime_access ON public.products;
CREATE POLICY products_realtime_access
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    -- Admin o empleado puede ver productos de su club
    club_id = (
      COALESCE(
        (SELECT a.club_id FROM public.admins a WHERE a.user_id = auth.uid() AND a.status = 'active'),
        (SELECT e.club_id FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active')
      )
    )
  );

-- Política para stock real-time
DROP POLICY IF EXISTS product_stock_realtime_access ON public.product_stock;
CREATE POLICY product_stock_realtime_access
  ON public.product_stock
  FOR SELECT
  TO authenticated
  USING (
    -- Stock de productos del club del usuario
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_stock.product_id
        AND p.club_id = (
          COALESCE(
            (SELECT a.club_id FROM public.admins a WHERE a.user_id = auth.uid() AND a.status = 'active'),
            (SELECT e.club_id FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active')
          )
        )
    )
  );

-- ========================================
-- PASO 4: FUNCIÓN DE TEST PARA REAL-TIME DE PRODUCTOS
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_test_product_realtime()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_test_product_id uuid;
  v_current_time text;
  v_initial_stock integer;
  v_test_stock integer;
BEGIN
  -- Obtener club del usuario
  SELECT COALESCE(
    (SELECT club_id FROM public.admins WHERE user_id = auth.uid() AND status = 'active'),
    (SELECT club_id FROM public.employees WHERE user_id = auth.uid() AND status = 'active')
  ) INTO v_club_id;

  IF v_club_id IS NULL THEN
    RETURN '❌ No eres admin ni empleado activo';
  END IF;

  v_current_time := to_char(now(), 'HH24:MI:SS');

  -- Buscar un producto existente para actualizar
  SELECT id INTO v_test_product_id
  FROM public.products
  WHERE club_id = v_club_id
    AND status = 'active'
  LIMIT 1;

  IF v_test_product_id IS NULL THEN
    RETURN '❌ No hay productos en tu club para probar';
  END IF;

  -- Obtener stock actual
  SELECT COALESCE(available_stock, 0) INTO v_initial_stock
  FROM public.product_stock
  WHERE product_id = v_test_product_id;

  -- Generar nuevo stock para test
  v_test_stock := (v_initial_stock + 10);

  -- Actualizar stock (esto debería trigger real-time)
  INSERT INTO public.product_stock (product_id, available_stock, reserved_stock)
  VALUES (v_test_product_id, v_test_stock, 0)
  ON CONFLICT (product_id)
  DO UPDATE SET
    available_stock = v_test_stock,
    updated_at = NOW();

  -- Esperar un momento
  PERFORM pg_sleep(1);

  -- Restaurar stock original
  INSERT INTO public.product_stock (product_id, available_stock, reserved_stock)
  VALUES (v_test_product_id, v_initial_stock, 0)
  ON CONFLICT (product_id)
  DO UPDATE SET
    available_stock = v_initial_stock,
    updated_at = NOW();

  RETURN '✅ Test de real-time para productos completado a las ' || v_current_time ||
         '. Si tenías el modal de ventas abierto, deberías haber visto:' || E'\n' ||
         '1️⃣ Stock cambiar de ' || v_initial_stock || ' a ' || v_test_stock || E'\n' ||
         '2️⃣ Stock restaurarse a ' || v_initial_stock || E'\n' ||
         'Producto ID: ' || v_test_product_id::text;

EXCEPTION WHEN OTHERS THEN
  RETURN '❌ Error en test: ' || SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_test_product_realtime() TO authenticated;

-- ========================================
-- PASO 5: FUNCIÓN DE VERIFICACIÓN
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_verify_product_realtime_setup()
RETURNS TABLE (
  check_name text,
  status text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar publicación realtime para products
  RETURN QUERY
  SELECT
    'products_realtime'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'products'
    ) THEN '✅ ENABLED' ELSE '❌ DISABLED' END::text,
    'Products table in realtime publication'::text;

  -- Verificar publicación realtime para product_stock
  RETURN QUERY
  SELECT
    'product_stock_realtime'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'product_stock'
    ) THEN '✅ ENABLED' ELSE '❌ DISABLED' END::text,
    'Product_stock table in realtime publication'::text;

  -- Verificar políticas RLS
  RETURN QUERY
  SELECT
    'products_rls_policies'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'products'
        AND policyname LIKE '%realtime%'
    ) THEN '✅ CONFIGURED' ELSE '❌ MISSING' END::text,
    'RLS policies for product realtime access'::text;

  -- Test de permisos
  RETURN QUERY
  SELECT
    'user_permissions'::text,
    CASE WHEN COALESCE(
      (SELECT club_id FROM public.admins WHERE user_id = auth.uid() AND status = 'active'),
      (SELECT club_id FROM public.employees WHERE user_id = auth.uid() AND status = 'active')
    ) IS NOT NULL THEN '✅ AUTHORIZED' ELSE '❌ UNAUTHORIZED' END::text,
    'User has admin or employee access'::text;

END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_verify_product_realtime_setup() TO authenticated;

-- ========================================
-- RESULTADO Y INSTRUCCIONES
-- ========================================

/*
🔧 REAL-TIME PARA PRODUCTOS Y STOCK CONFIGURADO

PARA VERIFICAR LA CONFIGURACIÓN:
SELECT * FROM fn_verify_product_realtime_setup();

PARA PROBAR REAL-TIME DE PRODUCTOS:
1. Abre modal de ventas (buscar productos)
2. En otra ventana ejecuta: SELECT fn_test_product_realtime();
3. Observa si los productos aparecen/desaparecen automáticamente

CAMBIOS APLICADOS:
✅ Tablas products y product_stock agregadas a supabase_realtime
✅ Políticas RLS para permitir real-time cross-usuario
✅ Replica identity configurada
✅ Funciones de test y verificación

RESULTADO ESPERADO:
- Admin actualiza stock → Empleado ve cambios inmediatamente
- Productos aparecen/desaparecen automáticamente en búsqueda
- Stock se actualiza en tiempo real sin refresh manual

IMPORTANTE: También necesitas actualizar el hook useProducts()
en el frontend para escuchar estos cambios.
*/

-- Mensaje final
SELECT '🚀 Real-time para productos habilitado. Ejecuta: SELECT * FROM fn_verify_product_realtime_setup(); para verificar.' as resultado;