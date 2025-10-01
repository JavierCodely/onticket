-- ===========================================================
-- VERIFICACIÓN Y FIX COMPLETO DEL SISTEMA DE PRODUCTOS
-- ===========================================================
-- Este script verifica y recrea todo lo necesario para crear productos
-- después del reset de categorías

-- ========================================
-- PASO 1: VERIFICAR CATEGORÍAS
-- ========================================

DO $$
DECLARE
  v_categories integer;
BEGIN
  SELECT COUNT(*) INTO v_categories
  FROM pg_enum
  WHERE enumtypid = 'product_category'::regtype;

  RAISE NOTICE '';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'VERIFICACIÓN DE CATEGORÍAS';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Categorías encontradas: %', v_categories;

  IF v_categories = 10 THEN
    RAISE NOTICE '✓ Categorías correctas';
  ELSE
    RAISE NOTICE '✗ ERROR: Deberían ser 10 categorías';
  END IF;
END$$;

-- ========================================
-- PASO 2: RECREAR FUNCIÓN DE CREACIÓN DE PRODUCTOS
-- ========================================

CREATE OR REPLACE FUNCTION public.create_product_with_stock(
  p_name text,
  p_category product_category,
  p_cost_price numeric,
  p_sale_price numeric,
  p_initial_stock integer DEFAULT 0,
  p_description text DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_unit product_unit DEFAULT 'unit',
  p_min_stock integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_club_id uuid;
BEGIN
  -- Obtener club del admin
  v_club_id := fn_current_admin_club_id();

  -- Verificar que es admin
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo admins pueden crear productos';
  END IF;

  -- Crear el producto
  INSERT INTO public.products (
    club_id,
    name,
    category,
    cost_price,
    sale_price,
    description,
    brand,
    sku,
    unit,
    min_stock,
    created_by
  ) VALUES (
    v_club_id,
    p_name,
    p_category,
    p_cost_price,
    p_sale_price,
    p_description,
    p_brand,
    p_sku,
    p_unit,
    p_min_stock,
    auth.uid()
  ) RETURNING id INTO v_product_id;

  -- Crear registro de stock inicial
  IF p_initial_stock > 0 THEN
    INSERT INTO public.product_stock (
      product_id,
      club_id,
      current_stock,
      last_restock_date,
      last_restock_quantity,
      updated_by
    ) VALUES (
      v_product_id,
      v_club_id,
      p_initial_stock,
      NOW(),
      p_initial_stock,
      auth.uid()
    );
  ELSE
    -- Crear registro de stock con 0 si no hay stock inicial
    INSERT INTO public.product_stock (
      product_id,
      club_id,
      current_stock,
      updated_by
    ) VALUES (
      v_product_id,
      v_club_id,
      0,
      auth.uid()
    );
  END IF;

  RETURN v_product_id;
END;
$$;

-- ========================================
-- PASO 3: VERIFICAR POLÍTICAS RLS
-- ========================================

-- Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS products_admin_select ON public.products;
DROP POLICY IF EXISTS products_admin_insert ON public.products;
DROP POLICY IF EXISTS products_admin_update ON public.products;
DROP POLICY IF EXISTS products_admin_delete ON public.products;
DROP POLICY IF EXISTS products_employee_select ON public.products;

-- Recrear políticas RLS para admins
CREATE POLICY products_admin_select
  ON public.products
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

CREATE POLICY products_admin_insert
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY products_admin_update
  ON public.products
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY products_admin_delete
  ON public.products
  FOR DELETE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- Política para empleados
CREATE POLICY products_employee_select
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  );

-- ========================================
-- PASO 4: VERIFICAR POLÍTICAS DE STOCK
-- ========================================

-- Eliminar políticas antiguas de stock
DROP POLICY IF EXISTS product_stock_admin_select ON public.product_stock;
DROP POLICY IF EXISTS product_stock_admin_insert ON public.product_stock;
DROP POLICY IF EXISTS product_stock_admin_update ON public.product_stock;
DROP POLICY IF EXISTS product_stock_employee_select ON public.product_stock;
DROP POLICY IF EXISTS product_stock_employee_update ON public.product_stock;

-- Recrear políticas RLS para stock
CREATE POLICY product_stock_admin_select
  ON public.product_stock
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

CREATE POLICY product_stock_admin_insert
  ON public.product_stock
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY product_stock_admin_update
  ON public.product_stock
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY product_stock_employee_select
  ON public.product_stock
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  );

CREATE POLICY product_stock_employee_update
  ON public.product_stock
  FOR UPDATE
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  )
  WITH CHECK (
    club_id = fn_current_employee_club_id()
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  );

-- ========================================
-- PASO 5: VERIFICACIÓN FINAL
-- ========================================

DO $$
DECLARE
  v_categories integer;
  v_products integer;
  v_clubs integer;
  v_function_exists boolean;
BEGIN
  -- Verificar categorías
  SELECT COUNT(*) INTO v_categories
  FROM pg_enum
  WHERE enumtypid = 'product_category'::regtype;

  -- Verificar productos
  SELECT COUNT(*) INTO v_products
  FROM public.products;

  -- Verificar clubs
  SELECT COUNT(*) INTO v_clubs
  FROM public.clubs;

  -- Verificar función
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_product_with_stock'
  ) INTO v_function_exists;

  RAISE NOTICE '';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'VERIFICACIÓN COMPLETA';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Categorías: %', v_categories;
  RAISE NOTICE 'Productos: %', v_products;
  RAISE NOTICE 'Clubs: %', v_clubs;
  RAISE NOTICE 'Función create_product_with_stock: %',
    CASE WHEN v_function_exists THEN '✓ EXISTE' ELSE '✗ NO EXISTE' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Categorías disponibles:';
  RAISE NOTICE '  ✓ vinos';
  RAISE NOTICE '  ✓ cervezas';
  RAISE NOTICE '  ✓ cocteles';
  RAISE NOTICE '  ✓ vodka';
  RAISE NOTICE '  ✓ bebidas_alcoholicas';
  RAISE NOTICE '  ✓ bebidas_sin_alcohol';
  RAISE NOTICE '  ✓ comida';
  RAISE NOTICE '  ✓ cigarrillos';
  RAISE NOTICE '  ✓ merchandising';
  RAISE NOTICE '  ✓ otros';
  RAISE NOTICE '';
  RAISE NOTICE 'Sistema listo para crear productos';
END$$;

/*
===========================================================
PRUEBA DE CREACIÓN DE PRODUCTO
===========================================================

-- Probar crear un producto con nueva categoría
SELECT create_product_with_stock(
  'Vino Malbec Tinto',
  'vinos',
  500.00,
  1200.00,
  24,
  'Vino tinto argentino 750ml',
  'Norton',
  'VIN-MAL-750',
  'bottle',
  6
);

-- Verificar que se creó correctamente
SELECT * FROM products_with_stock
WHERE name = 'Vino Malbec Tinto';

*/
