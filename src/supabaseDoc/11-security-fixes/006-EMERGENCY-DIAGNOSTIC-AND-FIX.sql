-- ===========================================================
-- 🚨 EMERGENCY DIAGNOSTIC AND COMPLETE FIX
-- ===========================================================
-- PROBLEMA PERSISTENTE: Admin sigue viendo datos de otros clubs
-- ESTRATEGIA: Diagnóstico completo + Fix nuclear + Verificación

-- ========================================
-- PASO 1: DIAGNÓSTICO ULTRA-COMPLETO
-- ========================================

-- Función de diagnóstico que revela TODO lo que está pasando
CREATE OR REPLACE FUNCTION public.fn_emergency_diagnostic()
RETURNS TABLE (
  step_number integer,
  diagnostic_type text,
  key_info text,
  value_info text,
  is_problem boolean,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid;
  v_jwt_role text;
  v_admin_club_id uuid;
  v_employee_club_id uuid;
  v_total_clubs integer;
  v_total_admins integer;
  v_total_sales integer;
  v_total_promotions integer;
  v_visible_sales integer;
  v_visible_promotions integer;
  v_my_sales integer;
  v_my_promotions integer;
  v_policy_count integer;
BEGIN
  -- PASO 1: Info básica del usuario
  v_current_user_id := auth.uid();
  v_jwt_role := auth.jwt() ->> 'role';

  RETURN QUERY SELECT 1, 'auth_info'::text, 'current_user_id'::text,
    COALESCE(v_current_user_id::text, 'NULL'),
    (v_current_user_id IS NULL),
    'ID del usuario autenticado'::text;

  RETURN QUERY SELECT 2, 'auth_info'::text, 'jwt_role'::text,
    COALESCE(v_jwt_role, 'NULL'),
    false,
    'Rol del JWT'::text;

  -- PASO 2: Verificar función fn_current_admin_club_id
  BEGIN
    v_admin_club_id := fn_current_admin_club_id();
  EXCEPTION WHEN OTHERS THEN
    v_admin_club_id := NULL;
  END;

  RETURN QUERY SELECT 3, 'function_test'::text, 'fn_current_admin_club_id'::text,
    COALESCE(v_admin_club_id::text, 'NULL'),
    (v_admin_club_id IS NULL),
    'Resultado de la función de club del admin'::text;

  -- PASO 3: Verificar función fn_current_employee_club_id
  BEGIN
    v_employee_club_id := fn_current_employee_club_id();
  EXCEPTION WHEN OTHERS THEN
    v_employee_club_id := NULL;
  END;

  RETURN QUERY SELECT 4, 'function_test'::text, 'fn_current_employee_club_id'::text,
    COALESCE(v_employee_club_id::text, 'NULL'),
    false,
    'Resultado de la función de club del empleado'::text;

  -- PASO 4: Verificar tabla admins directamente
  RETURN QUERY SELECT 5, 'table_check'::text, 'admins_direct_query'::text,
    COALESCE((
      SELECT a.club_id::text || ' (status: ' || a.status || ')'
      FROM public.admins a
      WHERE a.user_id = v_current_user_id
      LIMIT 1
    ), 'NOT_FOUND'),
    NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = v_current_user_id),
    'Consulta directa a tabla admins'::text;

  -- PASO 5: Contar registros totales
  SELECT COUNT(*) INTO v_total_clubs FROM public.clubs;
  SELECT COUNT(*) INTO v_total_admins FROM public.admins;
  SELECT COUNT(*) INTO v_total_sales FROM public.sales;
  SELECT COUNT(*) INTO v_total_promotions FROM public.promotions;

  RETURN QUERY SELECT 6, 'totals'::text, 'database_totals'::text,
    ('Clubs: ' || v_total_clubs || ', Admins: ' || v_total_admins ||
     ', Sales: ' || v_total_sales || ', Promotions: ' || v_total_promotions),
    false,
    'Totales en la base de datos'::text;

  -- PASO 6: Contar registros VISIBLES al usuario actual
  SELECT COUNT(*) INTO v_visible_sales FROM public.sales;
  SELECT COUNT(*) INTO v_visible_promotions FROM public.promotions;

  RETURN QUERY SELECT 7, 'visibility'::text, 'visible_to_user'::text,
    ('Sales: ' || v_visible_sales || ', Promotions: ' || v_visible_promotions),
    false,
    'Registros visibles al usuario actual'::text;

  -- PASO 7: Si tenemos club_id, contar solo los de nuestro club
  IF v_admin_club_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_my_sales FROM public.sales WHERE club_id = v_admin_club_id;
    SELECT COUNT(*) INTO v_my_promotions FROM public.promotions WHERE club_id = v_admin_club_id;

    RETURN QUERY SELECT 8, 'my_club_data'::text, 'should_be_visible'::text,
      ('My Sales: ' || v_my_sales || ', My Promotions: ' || v_my_promotions),
      false,
      'Datos que DEBERÍAN ser visibles (solo mi club)'::text;

    RETURN QUERY SELECT 9, 'problem_detection'::text, 'cross_contamination'::text,
      ('Visible Sales: ' || v_visible_sales || ' vs Should be: ' || v_my_sales ||
       ', Visible Promotions: ' || v_visible_promotions || ' vs Should be: ' || v_my_promotions),
      (v_visible_sales != v_my_sales OR v_visible_promotions != v_my_promotions),
      'PROBLEMA DETECTADO si los números no coinciden'::text;
  END IF;

  -- PASO 8: Verificar políticas RLS activas
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('sales', 'promotions');

  RETURN QUERY SELECT 10, 'rls_policies'::text, 'active_policies_count'::text,
    v_policy_count::text,
    (v_policy_count = 0),
    'Número de políticas RLS activas para sales y promotions'::text;

  -- PASO 9: Listar políticas específicas
  RETURN QUERY
  SELECT 11, 'rls_policies'::text, 'policy_details'::text,
    (tablename || '.' || policyname || ' (' || cmd || ')'),
    false,
    qual::text
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('sales', 'promotions')
  ORDER BY tablename, policyname;

END;
$$;

-- ========================================
-- PASO 2: FIX NUCLEAR - DESACTIVAR RLS Y RECREAR
-- ========================================

-- Función para aplicar fix nuclear (usar con extrema precaución)
CREATE OR REPLACE FUNCTION public.fn_apply_nuclear_fix()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text := '';
BEGIN
  v_result := v_result || '1. Disabling RLS...' || chr(10);

  -- Deshabilitar RLS temporalmente
  ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.sale_items DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.promotions DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.promotion_items DISABLE ROW LEVEL SECURITY;

  v_result := v_result || '2. Dropping all policies...' || chr(10);

  -- Eliminar TODAS las políticas
  DROP POLICY IF EXISTS sales_service_role_full_access ON public.sales;
  DROP POLICY IF EXISTS sales_admin_own_club_only ON public.sales;
  DROP POLICY IF EXISTS sales_all_service_role ON public.sales;
  DROP POLICY IF EXISTS sales_admin_select ON public.sales;
  DROP POLICY IF EXISTS sales_admin_insert ON public.sales;
  DROP POLICY IF EXISTS sales_admin_update ON public.sales;
  DROP POLICY IF EXISTS sales_admin_delete ON public.sales;

  DROP POLICY IF EXISTS promotions_service_role_full_access ON public.promotions;
  DROP POLICY IF EXISTS promotions_admin_own_club_only ON public.promotions;
  DROP POLICY IF EXISTS promotions_employees_view_active_own_club ON public.promotions;
  DROP POLICY IF EXISTS promotions_all_service_role ON public.promotions;
  DROP POLICY IF EXISTS promotions_admin_select ON public.promotions;
  DROP POLICY IF EXISTS promotions_admin_insert ON public.promotions;
  DROP POLICY IF EXISTS promotions_admin_update ON public.promotions;
  DROP POLICY IF EXISTS promotions_admin_delete ON public.promotions;
  DROP POLICY IF EXISTS promotions_employee_select ON public.promotions;

  v_result := v_result || '3. Re-enabling RLS...' || chr(10);

  -- Rehabilitar RLS
  ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.promotion_items ENABLE ROW LEVEL SECURITY;

  v_result := v_result || '4. Creating NEW ultra-simple policies...' || chr(10);

  -- POLÍTICA ULTRA-SIMPLE PARA SALES: Solo service_role o admin de mismo club
  CREATE POLICY sales_nuclear_fix
    ON public.sales
    FOR ALL
    TO authenticated
    USING (
      -- Service role puede todo
      (auth.jwt() ->> 'role') = 'service_role'
      OR
      -- Admin solo ve su club
      club_id = (
        SELECT club_id FROM public.admins
        WHERE user_id = auth.uid() AND status = 'active'
        LIMIT 1
      )
    )
    WITH CHECK (
      -- Service role puede todo
      (auth.jwt() ->> 'role') = 'service_role'
      OR
      -- Admin solo puede crear/editar en su club
      club_id = (
        SELECT club_id FROM public.admins
        WHERE user_id = auth.uid() AND status = 'active'
        LIMIT 1
      )
    );

  -- POLÍTICA ULTRA-SIMPLE PARA PROMOTIONS
  CREATE POLICY promotions_nuclear_fix
    ON public.promotions
    FOR ALL
    TO authenticated
    USING (
      -- Service role puede todo
      (auth.jwt() ->> 'role') = 'service_role'
      OR
      -- Admin ve promociones de su club
      club_id = (
        SELECT club_id FROM public.admins
        WHERE user_id = auth.uid() AND status = 'active'
        LIMIT 1
      )
      OR
      -- Empleado ve promociones activas de su club
      (status = 'active' AND club_id = (
        SELECT club_id FROM public.employees
        WHERE user_id = auth.uid() AND status = 'active'
        LIMIT 1
      ))
    )
    WITH CHECK (
      -- Service role puede todo
      (auth.jwt() ->> 'role') = 'service_role'
      OR
      -- Solo admin puede crear/editar
      club_id = (
        SELECT club_id FROM public.admins
        WHERE user_id = auth.uid() AND status = 'active'
        LIMIT 1
      )
    );

  -- Políticas para sale_items y promotion_items
  CREATE POLICY sale_items_nuclear_fix
    ON public.sale_items
    FOR ALL
    TO authenticated
    USING (
      (auth.jwt() ->> 'role') = 'service_role'
      OR
      EXISTS (
        SELECT 1 FROM public.sales s
        INNER JOIN public.admins a ON s.club_id = a.club_id
        WHERE s.id = sale_items.sale_id
          AND a.user_id = auth.uid()
          AND a.status = 'active'
      )
    )
    WITH CHECK (
      (auth.jwt() ->> 'role') = 'service_role'
      OR
      EXISTS (
        SELECT 1 FROM public.sales s
        INNER JOIN public.admins a ON s.club_id = a.club_id
        WHERE s.id = sale_items.sale_id
          AND a.user_id = auth.uid()
          AND a.status = 'active'
      )
    );

  CREATE POLICY promotion_items_nuclear_fix
    ON public.promotion_items
    FOR ALL
    TO authenticated
    USING (
      (auth.jwt() ->> 'role') = 'service_role'
      OR
      EXISTS (
        SELECT 1 FROM public.promotions p
        INNER JOIN public.admins a ON p.club_id = a.club_id
        WHERE p.id = promotion_items.promotion_id
          AND a.user_id = auth.uid()
          AND a.status = 'active'
      )
      OR
      -- Empleados pueden ver items de promociones activas
      EXISTS (
        SELECT 1 FROM public.promotions p
        INNER JOIN public.employees e ON p.club_id = e.club_id
        WHERE p.id = promotion_items.promotion_id
          AND p.status = 'active'
          AND e.user_id = auth.uid()
          AND e.status = 'active'
      )
    )
    WITH CHECK (
      (auth.jwt() ->> 'role') = 'service_role'
      OR
      EXISTS (
        SELECT 1 FROM public.promotions p
        INNER JOIN public.admins a ON p.club_id = a.club_id
        WHERE p.id = promotion_items.promotion_id
          AND a.user_id = auth.uid()
          AND a.status = 'active'
      )
    );

  v_result := v_result || '5. Nuclear fix applied successfully!' || chr(10);

  RETURN v_result;
END;
$$;

-- ========================================
-- PASO 3: FUNCIÓN DE VERIFICACIÓN FINAL
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_final_verification()
RETURNS TABLE (
  test_name text,
  result text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_club_id uuid;
  v_visible_sales integer;
  v_visible_promotions integer;
  v_my_club_sales integer;
  v_my_club_promotions integer;
  v_other_club_sales integer;
  v_other_club_promotions integer;
BEGIN
  -- Obtener club del admin actual
  v_admin_club_id := (
    SELECT club_id FROM public.admins
    WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1
  );

  IF v_admin_club_id IS NULL THEN
    RETURN QUERY SELECT
      'authentication'::text,
      'FAIL'::text,
      'Usuario no es admin activo'::text;
    RETURN;
  END IF;

  -- Contar registros visibles
  SELECT COUNT(*) INTO v_visible_sales FROM public.sales;
  SELECT COUNT(*) INTO v_visible_promotions FROM public.promotions;

  -- Contar registros de mi club
  SELECT COUNT(*) INTO v_my_club_sales FROM public.sales WHERE club_id = v_admin_club_id;
  SELECT COUNT(*) INTO v_my_club_promotions FROM public.promotions WHERE club_id = v_admin_club_id;

  -- Contar registros de otros clubs (NO deberían ser visibles)
  SELECT COUNT(*) INTO v_other_club_sales FROM public.sales WHERE club_id != v_admin_club_id;
  SELECT COUNT(*) INTO v_other_club_promotions FROM public.promotions WHERE club_id != v_admin_club_id;

  -- Test de ventas
  RETURN QUERY SELECT
    'sales_isolation'::text,
    CASE WHEN v_other_club_sales = 0 THEN 'PASS' ELSE 'FAIL' END::text,
    ('Visible: ' || v_visible_sales || ', Mi club: ' || v_my_club_sales ||
     ', Otros clubs: ' || v_other_club_sales)::text;

  -- Test de promociones
  RETURN QUERY SELECT
    'promotions_isolation'::text,
    CASE WHEN v_other_club_promotions = 0 THEN 'PASS' ELSE 'FAIL' END::text,
    ('Visible: ' || v_visible_promotions || ', Mi club: ' || v_my_club_promotions ||
     ', Otros clubs: ' || v_other_club_promotions)::text;

  -- Test general
  RETURN QUERY SELECT
    'overall_result'::text,
    CASE WHEN v_other_club_sales = 0 AND v_other_club_promotions = 0
         THEN 'PASS' ELSE 'FAIL' END::text,
    ('Admin Club: ' || v_admin_club_id::text ||
     ', Cross-contamination: ' || (v_other_club_sales + v_other_club_promotions) || ' records')::text;
END;
$$;

-- ========================================
-- INSTRUCCIONES DE USO
-- ========================================

/*
🚨 EMERGENCY DIAGNOSTIC AND FIX

PASOS A SEGUIR:

1. EJECUTAR DIAGNÓSTICO:
   SELECT * FROM fn_emergency_diagnostic()
   ORDER BY step_number;

2. SI HAY PROBLEMAS, APLICAR FIX NUCLEAR:
   SELECT fn_apply_nuclear_fix();

3. VERIFICAR RESULTADO:
   SELECT * FROM fn_final_verification();

⚠️ ADVERTENCIA: El fix nuclear elimina TODAS las políticas RLS existentes
y las reemplaza con políticas ultra-simples. Solo usar si es necesario.

El objetivo es crear políticas tan simples que no puedan fallar:
- Una sola política por tabla
- Lógica directa sin funciones auxiliares
- Solo admin de mismo club puede ver datos
*/