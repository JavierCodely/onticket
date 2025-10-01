-- ===========================================================
-- 🔒 FINAL CROSS-CLUB DATA ISOLATION FIX - VENTAS Y PROMOCIONES
-- ===========================================================
-- PROBLEMA IDENTIFICADO: Los admins ven ventas y promociones de otros clubs
-- SOLUCIÓN: Reimplementar políticas RLS de manera más estricta y directa
--
-- ⚠️ EJECUTAR CON CUIDADO - Este script reemplaza todas las políticas de
--    sales, sale_items, promotions y promotion_items

-- ========================================
-- PASO 1: FUNCIÓN DE DIAGNÓSTICO RÁPIDA
-- ========================================

-- Función para verificar el estado actual antes del fix
CREATE OR REPLACE FUNCTION public.fn_audit_cross_club_issue()
RETURNS TABLE (
  audit_type text,
  current_user_id uuid,
  admin_club_id uuid,
  table_name text,
  total_records integer,
  my_club_records integer,
  other_club_records integer,
  problem_detected boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user uuid;
  v_my_club_id uuid;
  v_sales_total integer;
  v_sales_mine integer;
  v_sales_others integer;
  v_promotions_total integer;
  v_promotions_mine integer;
  v_promotions_others integer;
BEGIN
  -- Obtener info del usuario actual
  v_current_user := auth.uid();
  v_my_club_id := fn_current_admin_club_id();

  IF v_my_club_id IS NULL THEN
    RETURN QUERY SELECT
      'error'::text, v_current_user, v_my_club_id, 'N/A'::text, 0, 0, 0, true;
    RETURN;
  END IF;

  -- Auditar Sales
  SELECT COUNT(*) INTO v_sales_total FROM public.sales;
  SELECT COUNT(*) INTO v_sales_mine FROM public.sales WHERE club_id = v_my_club_id;
  SELECT COUNT(*) INTO v_sales_others FROM public.sales WHERE club_id != v_my_club_id;

  RETURN QUERY SELECT
    'sales_audit'::text,
    v_current_user,
    v_my_club_id,
    'sales'::text,
    v_sales_total,
    v_sales_mine,
    v_sales_others,
    (v_sales_others > 0);

  -- Auditar Promotions
  SELECT COUNT(*) INTO v_promotions_total FROM public.promotions;
  SELECT COUNT(*) INTO v_promotions_mine FROM public.promotions WHERE club_id = v_my_club_id;
  SELECT COUNT(*) INTO v_promotions_others FROM public.promotions WHERE club_id != v_my_club_id;

  RETURN QUERY SELECT
    'promotions_audit'::text,
    v_current_user,
    v_my_club_id,
    'promotions'::text,
    v_promotions_total,
    v_promotions_mine,
    v_promotions_others,
    (v_promotions_others > 0);

END;
$$;

-- ========================================
-- PASO 2: LIMPIAR TODAS LAS POLÍTICAS EXISTENTES
-- ========================================

-- 2.1) Eliminar TODAS las políticas existentes de sales
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Obtener todas las políticas de sales
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sales', policy_record.policyname);
  END LOOP;
END$$;

-- 2.2) Eliminar TODAS las políticas existentes de sale_items
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sale_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sale_items', policy_record.policyname);
  END LOOP;
END$$;

-- 2.3) Eliminar TODAS las políticas existentes de promotions
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'promotions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.promotions', policy_record.policyname);
  END LOOP;
END$$;

-- 2.4) Eliminar TODAS las políticas existentes de promotion_items
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'promotion_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.promotion_items', policy_record.policyname);
  END LOOP;
END$$;

-- ========================================
-- PASO 3: CREAR POLÍTICAS ULTRA-RESTRICTIVAS
-- ========================================

-- 3.1) POLÍTICAS PARA SALES - Solo service_role y admin del mismo club

-- Service role puede todo
CREATE POLICY sales_service_role_full_access
  ON public.sales
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- Admin solo puede ver/editar ventas de su club
CREATE POLICY sales_admin_own_club_only
  ON public.sales
  FOR ALL
  TO authenticated
  USING (
    club_id = (
      SELECT a.club_id
      FROM public.admins a
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
      LIMIT 1
    )
  )
  WITH CHECK (
    club_id = (
      SELECT a.club_id
      FROM public.admins a
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
      LIMIT 1
    )
  );

-- 3.2) POLÍTICAS PARA SALE_ITEMS - Solo items de ventas del club del admin

-- Service role puede todo
CREATE POLICY sale_items_service_role_full_access
  ON public.sale_items
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- Admin solo puede ver/editar items de ventas de su club
CREATE POLICY sale_items_admin_own_club_only
  ON public.sale_items
  FOR ALL
  TO authenticated
  USING (
    sale_id IN (
      SELECT s.id
      FROM public.sales s
      INNER JOIN public.admins a ON a.club_id = s.club_id
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
  )
  WITH CHECK (
    sale_id IN (
      SELECT s.id
      FROM public.sales s
      INNER JOIN public.admins a ON a.club_id = s.club_id
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
  );

-- 3.3) POLÍTICAS PARA PROMOTIONS - Solo promociones del club del admin

-- Service role puede todo
CREATE POLICY promotions_service_role_full_access
  ON public.promotions
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- Admin solo puede ver/editar promociones de su club
CREATE POLICY promotions_admin_own_club_only
  ON public.promotions
  FOR ALL
  TO authenticated
  USING (
    club_id = (
      SELECT a.club_id
      FROM public.admins a
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
      LIMIT 1
    )
  )
  WITH CHECK (
    club_id = (
      SELECT a.club_id
      FROM public.admins a
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
      LIMIT 1
    )
  );

-- Empleados pueden VER promociones activas de su club (solo lectura)
CREATE POLICY promotions_employees_view_active_own_club
  ON public.promotions
  FOR SELECT
  TO authenticated
  USING (
    status = 'active'
    AND club_id = (
      SELECT e.club_id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
      LIMIT 1
    )
  );

-- 3.4) POLÍTICAS PARA PROMOTION_ITEMS - Solo items de promociones del club

-- Service role puede todo
CREATE POLICY promotion_items_service_role_full_access
  ON public.promotion_items
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- Admin solo puede ver/editar items de promociones de su club
CREATE POLICY promotion_items_admin_own_club_only
  ON public.promotion_items
  FOR ALL
  TO authenticated
  USING (
    promotion_id IN (
      SELECT p.id
      FROM public.promotions p
      INNER JOIN public.admins a ON a.club_id = p.club_id
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
  )
  WITH CHECK (
    promotion_id IN (
      SELECT p.id
      FROM public.promotions p
      INNER JOIN public.admins a ON a.club_id = p.club_id
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
  );

-- Empleados pueden VER items de promociones activas de su club
CREATE POLICY promotion_items_employees_view_active_own_club
  ON public.promotion_items
  FOR SELECT
  TO authenticated
  USING (
    promotion_id IN (
      SELECT p.id
      FROM public.promotions p
      INNER JOIN public.employees e ON e.club_id = p.club_id
      WHERE p.status = 'active'
        AND e.user_id = auth.uid()
        AND e.status = 'active'
    )
  );

-- ========================================
-- PASO 4: FUNCIÓN DE VERIFICACIÓN FINAL
-- ========================================

-- Función para verificar que el fix funcionó correctamente
CREATE OR REPLACE FUNCTION public.fn_verify_cross_club_fix()
RETURNS TABLE (
  test_name text,
  expected_count integer,
  actual_count integer,
  result text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_club_id uuid;
  v_sales_visible integer;
  v_sales_wrong_club integer;
  v_promotions_visible integer;
  v_promotions_wrong_club integer;
  v_user_role text;
BEGIN
  -- Determinar club y rol del usuario actual
  v_my_club_id := fn_current_admin_club_id();

  IF v_my_club_id IS NULL THEN
    -- Verificar si es empleado
    SELECT e.club_id, 'employee'
    INTO v_my_club_id, v_user_role
    FROM public.employees e
    WHERE e.user_id = auth.uid() AND e.status = 'active'
    LIMIT 1;
  ELSE
    v_user_role := 'admin';
  END IF;

  IF v_my_club_id IS NULL THEN
    RETURN QUERY SELECT
      'authentication'::text,
      1,
      0,
      'FAIL'::text,
      'Usuario no autenticado como admin o empleado activo'::text;
    RETURN;
  END IF;

  -- Test 1: Contar ventas visibles (solo admins deberían ver ventas)
  IF v_user_role = 'admin' THEN
    SELECT COUNT(*) INTO v_sales_visible FROM public.sales;
    SELECT COUNT(*) INTO v_sales_wrong_club FROM public.sales WHERE club_id != v_my_club_id;

    RETURN QUERY SELECT
      'sales_isolation'::text,
      0,
      v_sales_wrong_club,
      CASE WHEN v_sales_wrong_club = 0 THEN 'PASS' ELSE 'FAIL' END::text,
      ('Ventas visibles: ' || v_sales_visible || ', de otros clubs: ' || v_sales_wrong_club)::text;
  END IF;

  -- Test 2: Contar promociones visibles
  SELECT COUNT(*) INTO v_promotions_visible FROM public.promotions;
  SELECT COUNT(*) INTO v_promotions_wrong_club FROM public.promotions WHERE club_id != v_my_club_id;

  RETURN QUERY SELECT
    'promotions_isolation'::text,
    0,
    v_promotions_wrong_club,
    CASE WHEN v_promotions_wrong_club = 0 THEN 'PASS' ELSE 'FAIL' END::text,
    ('Promociones visibles: ' || v_promotions_visible || ', de otros clubs: ' || v_promotions_wrong_club)::text;

  -- Test 3: Verificación general
  RETURN QUERY SELECT
    'overall_security'::text,
    0,
    COALESCE(v_sales_wrong_club, 0) + v_promotions_wrong_club,
    CASE WHEN COALESCE(v_sales_wrong_club, 0) = 0 AND v_promotions_wrong_club = 0
         THEN 'PASS' ELSE 'FAIL' END::text,
    ('Usuario: ' || v_user_role || ', Club: ' || v_my_club_id::text ||
     ', Problemas detectados: ' || (COALESCE(v_sales_wrong_club, 0) + v_promotions_wrong_club))::text;

END;
$$;

-- ========================================
-- PASO 5: INSTRUCCIONES DE USO
-- ========================================

/*
🔒 CROSS-CLUB DATA ISOLATION FIX APLICADO

ANTES DE APLICAR EL FIX:
SELECT * FROM fn_audit_cross_club_issue();

DESPUÉS DE APLICAR EL FIX:
SELECT * FROM fn_verify_cross_club_fix();

CAMBIOS APLICADOS:
✅ Eliminadas TODAS las políticas RLS existentes de sales/promotions
✅ Creadas políticas ultra-restrictivas que solo permiten ver datos del propio club
✅ Service role mantiene acceso completo para operaciones de backend
✅ Admins solo ven datos de su club específico
✅ Empleados solo ven promociones activas de su club (lectura únicamente)

POLÍTICAS IMPLEMENTADAS:
- sales: Solo admins ven ventas de su club
- sale_items: Solo items de ventas del club del admin
- promotions: Solo admins gestionan promociones de su club, empleados las ven
- promotion_items: Solo items de promociones del club correspondiente

VALIDACIÓN:
Ejecutar: SELECT * FROM fn_verify_cross_club_fix();
Debe mostrar resultado 'PASS' en todos los tests.

Si sigue habiendo problemas, el issue podría ser:
1. Cache del frontend
2. Contexto de autenticación en la aplicación
3. Consultas que bypasean RLS (usando service_role indebidamente)
*/