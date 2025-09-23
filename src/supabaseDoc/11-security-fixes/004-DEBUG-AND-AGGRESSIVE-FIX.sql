-- ===========================================================
-- 🔍 DEBUG + AGGRESSIVE FIX PARA SALES Y PROMOTIONS
-- ===========================================================
-- PROBLEMA: Sigue habiendo cross-contamination en ventas y promociones
-- OBJETIVO: Debuggear y aplicar fix más agresivo

-- ========================================
-- PASO 1: FUNCIÓN DE DEBUG COMPLETA
-- ========================================

-- Función para debuggear exactamente qué está pasando
CREATE OR REPLACE FUNCTION public.fn_debug_cross_contamination()
RETURNS TABLE (
  issue_type text,
  table_name text,
  record_id uuid,
  record_club_id uuid,
  user_club_id uuid,
  user_role text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid;
  v_admin_club_id uuid;
  v_employee_club_id uuid;
BEGIN
  v_current_user_id := auth.uid();
  v_admin_club_id := fn_current_admin_club_id();
  v_employee_club_id := fn_current_employee_club_id();

  -- Debug info del usuario actual
  RETURN QUERY
  SELECT
    'user_info'::text,
    'auth_users'::text,
    v_current_user_id,
    COALESCE(v_admin_club_id, v_employee_club_id),
    COALESCE(v_admin_club_id, v_employee_club_id),
    CASE
      WHEN v_admin_club_id IS NOT NULL THEN 'admin'
      WHEN v_employee_club_id IS NOT NULL THEN 'employee'
      ELSE 'none'
    END::text,
    ('User: ' || COALESCE(v_current_user_id::text, 'NULL') ||
     ', Admin Club: ' || COALESCE(v_admin_club_id::text, 'NULL') ||
     ', Employee Club: ' || COALESCE(v_employee_club_id::text, 'NULL'))::text;

  -- Verificar todas las ventas visibles al usuario actual
  RETURN QUERY
  SELECT
    'sales_visible'::text,
    'sales'::text,
    s.id,
    s.club_id,
    COALESCE(v_admin_club_id, v_employee_club_id),
    CASE
      WHEN v_admin_club_id IS NOT NULL THEN 'admin'
      WHEN v_employee_club_id IS NOT NULL THEN 'employee'
      ELSE 'none'
    END::text,
    ('Sale: ' || s.sale_number || ', Club: ' || s.club_id::text ||
     ', Should be visible: ' ||
     CASE WHEN s.club_id = COALESCE(v_admin_club_id, v_employee_club_id)
          THEN 'YES' ELSE 'NO' END)::text
  FROM public.sales s
  ORDER BY s.created_at DESC
  LIMIT 20;

  -- Verificar todas las promociones visibles al usuario actual
  RETURN QUERY
  SELECT
    'promotions_visible'::text,
    'promotions'::text,
    p.id,
    p.club_id,
    COALESCE(v_admin_club_id, v_employee_club_id),
    CASE
      WHEN v_admin_club_id IS NOT NULL THEN 'admin'
      WHEN v_employee_club_id IS NOT NULL THEN 'employee'
      ELSE 'none'
    END::text,
    ('Promotion: ' || p.name || ', Club: ' || p.club_id::text ||
     ', Should be visible: ' ||
     CASE WHEN p.club_id = COALESCE(v_admin_club_id, v_employee_club_id)
          THEN 'YES' ELSE 'NO' END)::text
  FROM public.promotions p
  ORDER BY p.created_at DESC
  LIMIT 20;

  -- Verificar clubs disponibles
  RETURN QUERY
  SELECT
    'clubs_info'::text,
    'clubs'::text,
    c.id,
    c.id,
    COALESCE(v_admin_club_id, v_employee_club_id),
    'info'::text,
    ('Club: ' || c.name || ', Status: ' || c.status::text)::text
  FROM public.clubs c
  ORDER BY c.created_at;

END;
$$;

-- ========================================
-- PASO 2: VERIFICAR ESTADO ACTUAL DE POLÍTICAS RLS
-- ========================================

-- Función para verificar qué políticas están activas
CREATE OR REPLACE FUNCTION public.fn_check_rls_policies()
RETURNS TABLE (
  table_name text,
  policy_name text,
  policy_cmd text,
  policy_qual text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    schemaname || '.' || tablename as table_name,
    policyname as policy_name,
    cmd as policy_cmd,
    qual as policy_qual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('sales', 'sale_items', 'promotions', 'promotion_items')
  ORDER BY tablename, policyname;
$$;

-- ========================================
-- PASO 3: ELIMINACION COMPLETA Y RECONSTRUCCIÓN AGRESIVA
-- ========================================

-- 3.1) ELIMINAR TODAS las políticas problemáticas
DROP POLICY IF EXISTS sales_admin_select_fixed ON public.sales;
DROP POLICY IF EXISTS sales_admin_insert_fixed ON public.sales;
DROP POLICY IF EXISTS sales_admin_update_fixed ON public.sales;
DROP POLICY IF EXISTS sales_admin_delete_fixed ON public.sales;

DROP POLICY IF EXISTS sale_items_admin_select_fixed ON public.sale_items;
DROP POLICY IF EXISTS sale_items_admin_insert_fixed ON public.sale_items;
DROP POLICY IF EXISTS sale_items_admin_update_fixed ON public.sale_items;
DROP POLICY IF EXISTS sale_items_admin_delete_fixed ON public.sale_items;

DROP POLICY IF EXISTS promotions_admin_select_fixed ON public.promotions;
DROP POLICY IF EXISTS promotions_admin_insert_fixed ON public.promotions;
DROP POLICY IF EXISTS promotions_admin_update_fixed ON public.promotions;
DROP POLICY IF EXISTS promotions_admin_delete_fixed ON public.promotions;
DROP POLICY IF EXISTS promotions_employee_select_fixed ON public.promotions;

DROP POLICY IF EXISTS promotion_items_admin_all_fixed ON public.promotion_items;
DROP POLICY IF EXISTS promotion_items_employee_select_fixed ON public.promotion_items;

-- 3.2) CREAR POLÍTICAS ULTRA-AGRESIVAS PARA SALES

-- SOLO permitir a admins ver ventas de SU club (política más simple y directa)
CREATE POLICY sales_admin_only_own_club
  ON public.sales
  FOR ALL
  TO authenticated
  USING (
    -- Solo si es admin Y el club coincide Y no es NULL
    auth.uid() IN (
      SELECT a.user_id
      FROM public.admins a
      WHERE a.status = 'active'
        AND a.club_id = sales.club_id
    )
  )
  WITH CHECK (
    -- Solo si es admin Y el club coincide Y no es NULL
    auth.uid() IN (
      SELECT a.user_id
      FROM public.admins a
      WHERE a.status = 'active'
        AND a.club_id = sales.club_id
    )
  );

-- 3.3) CREAR POLÍTICAS ULTRA-AGRESIVAS PARA SALE_ITEMS

CREATE POLICY sale_items_admin_only_own_club
  ON public.sale_items
  FOR ALL
  TO authenticated
  USING (
    -- Solo si la venta pertenece al club del admin
    EXISTS (
      SELECT 1
      FROM public.sales s
      INNER JOIN public.admins a ON a.club_id = s.club_id
      WHERE s.id = sale_items.sale_id
        AND a.user_id = auth.uid()
        AND a.status = 'active'
    )
  )
  WITH CHECK (
    -- Solo si la venta pertenece al club del admin
    EXISTS (
      SELECT 1
      FROM public.sales s
      INNER JOIN public.admins a ON a.club_id = s.club_id
      WHERE s.id = sale_items.sale_id
        AND a.user_id = auth.uid()
        AND a.status = 'active'
    )
  );

-- 3.4) CREAR POLÍTICAS ULTRA-AGRESIVAS PARA PROMOTIONS

-- SOLO permitir a admins ver promociones de SU club
CREATE POLICY promotions_admin_only_own_club
  ON public.promotions
  FOR ALL
  TO authenticated
  USING (
    -- Solo si es admin Y el club coincide Y no es NULL
    auth.uid() IN (
      SELECT a.user_id
      FROM public.admins a
      WHERE a.status = 'active'
        AND a.club_id = promotions.club_id
    )
  )
  WITH CHECK (
    -- Solo si es admin Y el club coincide Y no es NULL
    auth.uid() IN (
      SELECT a.user_id
      FROM public.admins a
      WHERE a.status = 'active'
        AND a.club_id = promotions.club_id
    )
  );

-- Empleados pueden ver promociones activas de su club
CREATE POLICY promotions_employee_view_active
  ON public.promotions
  FOR SELECT
  TO authenticated
  USING (
    status = 'active'
    AND auth.uid() IN (
      SELECT e.user_id
      FROM public.employees e
      WHERE e.status = 'active'
        AND e.club_id = promotions.club_id
        AND e.category IN ('bartender', 'cashier', 'waiter', 'manager')
    )
  );

-- 3.5) CREAR POLÍTICAS ULTRA-AGRESIVAS PARA PROMOTION_ITEMS

CREATE POLICY promotion_items_admin_only_own_club
  ON public.promotion_items
  FOR ALL
  TO authenticated
  USING (
    -- Solo si la promoción pertenece al club del admin
    EXISTS (
      SELECT 1
      FROM public.promotions p
      INNER JOIN public.admins a ON a.club_id = p.club_id
      WHERE p.id = promotion_items.promotion_id
        AND a.user_id = auth.uid()
        AND a.status = 'active'
    )
  )
  WITH CHECK (
    -- Solo si la promoción pertenece al club del admin
    EXISTS (
      SELECT 1
      FROM public.promotions p
      INNER JOIN public.admins a ON a.club_id = p.club_id
      WHERE p.id = promotion_items.promotion_id
        AND a.user_id = auth.uid()
        AND a.status = 'active'
    )
  );

-- Empleados pueden ver items de promociones activas de su club
CREATE POLICY promotion_items_employee_view_active
  ON public.promotion_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.promotions p
      INNER JOIN public.employees e ON e.club_id = p.club_id
      WHERE p.id = promotion_items.promotion_id
        AND p.status = 'active'
        AND e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier', 'waiter', 'manager')
    )
  );

-- ========================================
-- PASO 4: FUNCIÓN DE VERIFICACIÓN FINAL
-- ========================================

-- Función para verificar que el fix funcionó
CREATE OR REPLACE FUNCTION public.fn_verify_no_cross_contamination()
RETURNS TABLE (
  test_name text,
  expected_result text,
  actual_result text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_club_id uuid;
  v_sales_count integer;
  v_promotions_count integer;
  v_wrong_sales_count integer;
  v_wrong_promotions_count integer;
BEGIN
  -- Obtener club del usuario actual
  v_user_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());

  IF v_user_club_id IS NULL THEN
    RETURN QUERY
    SELECT
      'user_authentication'::text,
      'User should be authenticated'::text,
      'User is not authenticated or not admin/employee'::text,
      'FAIL'::text;
    RETURN;
  END IF;

  -- Contar ventas visibles
  SELECT COUNT(*) INTO v_sales_count
  FROM public.sales;

  -- Contar ventas que NO deberían ser visibles
  SELECT COUNT(*) INTO v_wrong_sales_count
  FROM public.sales s
  WHERE s.club_id != v_user_club_id;

  -- Test de ventas
  RETURN QUERY
  SELECT
    'sales_isolation'::text,
    'Only sales from user club should be visible'::text,
    ('Total visible: ' || v_sales_count || ', Wrong club: ' || v_wrong_sales_count)::text,
    CASE WHEN v_wrong_sales_count = 0 THEN 'PASS' ELSE 'FAIL' END::text;

  -- Contar promociones visibles
  SELECT COUNT(*) INTO v_promotions_count
  FROM public.promotions;

  -- Contar promociones que NO deberían ser visibles
  SELECT COUNT(*) INTO v_wrong_promotions_count
  FROM public.promotions p
  WHERE p.club_id != v_user_club_id;

  -- Test de promociones
  RETURN QUERY
  SELECT
    'promotions_isolation'::text,
    'Only promotions from user club should be visible'::text,
    ('Total visible: ' || v_promotions_count || ', Wrong club: ' || v_wrong_promotions_count)::text,
    CASE WHEN v_wrong_promotions_count = 0 THEN 'PASS' ELSE 'FAIL' END::text;

  -- Test general
  RETURN QUERY
  SELECT
    'overall_security'::text,
    'No cross-contamination should exist'::text,
    ('Wrong sales: ' || v_wrong_sales_count || ', Wrong promotions: ' || v_wrong_promotions_count)::text,
    CASE WHEN v_wrong_sales_count = 0 AND v_wrong_promotions_count = 0
         THEN 'PASS' ELSE 'FAIL' END::text;

END;
$$;

-- ========================================
-- COMENTARIOS DE DEBUG Y VERIFICACIÓN
-- ========================================

/*
🔍 DEBUG + AGGRESSIVE FIX APLICADO

NUEVAS HERRAMIENTAS DE DEBUG:
1. fn_debug_cross_contamination() - Muestra exactamente qué ve el usuario
2. fn_check_rls_policies() - Lista todas las políticas RLS activas
3. fn_verify_no_cross_contamination() - Verifica que no hay contaminación

POLÍTICAS ULTRA-AGRESIVAS APLICADAS:
- Sales: Solo admins ven ventas de SU club específico
- Sale_items: Solo items de ventas del club del admin
- Promotions: Solo admins ven promociones de SU club + empleados ven activas
- Promotion_items: Solo items de promociones del club correspondiente

CÓMO DEBUGGEAR:
1. Ejecutar: SELECT * FROM fn_debug_cross_contamination();
2. Verificar: SELECT * FROM fn_check_rls_policies();
3. Validar: SELECT * FROM fn_verify_no_cross_contamination();

DIFERENCIA CLAVE:
- Usa INNER JOIN con admins/employees directamente en la política
- No depende de funciones que puedan fallar
- Validación directa en la base de datos
- Más restrictivo que antes

SI SIGUE FALLANDO:
- El problema podría estar en el frontend (cache, contexto)
- O hay un bypass de RLS en algún lugar
- O hay datos corruptos que necesitan limpieza
*/