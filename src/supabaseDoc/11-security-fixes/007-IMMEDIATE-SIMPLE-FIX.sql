-- ===========================================================
-- 🚀 IMMEDIATE SIMPLE FIX - APLICAR AHORA MISMO
-- ===========================================================
-- Fix inmediato sin diagnósticos complejos
-- Solo reemplaza las políticas problemáticas con versiones ultra-simples

-- ========================================
-- ELIMINAR TODAS LAS POLÍTICAS ACTUALES
-- ========================================

-- Sales policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'sales' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.sales';
    END LOOP;
END $$;

-- Promotions policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'promotions' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.promotions';
    END LOOP;
END $$;

-- Sale_items policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'sale_items' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.sale_items';
    END LOOP;
END $$;

-- Promotion_items policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'promotion_items' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.promotion_items';
    END LOOP;
END $$;

-- ========================================
-- CREAR POLÍTICAS ULTRA-SIMPLES
-- ========================================

-- SALES: Solo admin ve ventas de su club
CREATE POLICY sales_simple_fix
  ON public.sales
  FOR ALL
  TO authenticated
  USING (
    -- Service role siempre puede
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    -- Admin solo ve su club (consulta directa, sin funciones)
    club_id IN (
      SELECT a.club_id
      FROM public.admins a
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
  )
  WITH CHECK (
    -- Service role siempre puede
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    -- Admin solo puede crear/editar en su club
    club_id IN (
      SELECT a.club_id
      FROM public.admins a
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
  );

-- PROMOTIONS: Solo admin ve promociones de su club
CREATE POLICY promotions_simple_fix
  ON public.promotions
  FOR ALL
  TO authenticated
  USING (
    -- Service role siempre puede
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    -- Admin ve promociones de su club
    club_id IN (
      SELECT a.club_id
      FROM public.admins a
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
    OR
    -- Empleado ve promociones activas de su club
    (
      status = 'active'
      AND club_id IN (
        SELECT e.club_id
        FROM public.employees e
        WHERE e.user_id = auth.uid()
          AND e.status = 'active'
      )
    )
  )
  WITH CHECK (
    -- Service role siempre puede
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    -- Solo admin puede crear/editar
    club_id IN (
      SELECT a.club_id
      FROM public.admins a
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
  );

-- SALE_ITEMS: Solo items de ventas del club del admin
CREATE POLICY sale_items_simple_fix
  ON public.sale_items
  FOR ALL
  TO authenticated
  USING (
    -- Service role siempre puede
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    -- Solo items de ventas del club del admin
    sale_id IN (
      SELECT s.id
      FROM public.sales s
      INNER JOIN public.admins a ON s.club_id = a.club_id
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
  )
  WITH CHECK (
    -- Service role siempre puede
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    -- Solo puede crear items para ventas de su club
    sale_id IN (
      SELECT s.id
      FROM public.sales s
      INNER JOIN public.admins a ON s.club_id = a.club_id
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
  );

-- PROMOTION_ITEMS: Solo items de promociones del club
CREATE POLICY promotion_items_simple_fix
  ON public.promotion_items
  FOR ALL
  TO authenticated
  USING (
    -- Service role siempre puede
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    -- Solo items de promociones del club del admin/empleado
    promotion_id IN (
      SELECT p.id
      FROM public.promotions p
      INNER JOIN public.admins a ON p.club_id = a.club_id
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
    OR
    -- Empleados pueden ver items de promociones activas de su club
    promotion_id IN (
      SELECT p.id
      FROM public.promotions p
      INNER JOIN public.employees e ON p.club_id = e.club_id
      WHERE p.status = 'active'
        AND e.user_id = auth.uid()
        AND e.status = 'active'
    )
  )
  WITH CHECK (
    -- Service role siempre puede
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    -- Solo admin puede crear/editar
    promotion_id IN (
      SELECT p.id
      FROM public.promotions p
      INNER JOIN public.admins a ON p.club_id = a.club_id
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
    )
  );

-- ========================================
-- VERIFICACIÓN INMEDIATA
-- ========================================

-- Función simple para verificar que el fix funcionó
CREATE OR REPLACE FUNCTION public.fn_quick_check()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_club_id uuid;
  v_sales_count integer;
  v_promotions_count integer;
  v_result text;
BEGIN
  -- Obtener mi club_id
  SELECT club_id INTO v_my_club_id
  FROM public.admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_my_club_id IS NULL THEN
    RETURN '❌ ERROR: No eres admin activo';
  END IF;

  -- Contar ventas visibles
  SELECT COUNT(*) INTO v_sales_count FROM public.sales;

  -- Contar promociones visibles
  SELECT COUNT(*) INTO v_promotions_count FROM public.promotions;

  -- Construir resultado
  v_result := '✅ Fix aplicado para club: ' || v_my_club_id::text || chr(10);
  v_result := v_result || '📊 Ventas visibles: ' || v_sales_count || chr(10);
  v_result := v_result || '🎯 Promociones visibles: ' || v_promotions_count || chr(10);

  -- Verificar si hay cross-contamination
  IF EXISTS (SELECT 1 FROM public.sales WHERE club_id != v_my_club_id) THEN
    v_result := v_result || '⚠️ PROBLEMA: Siguen siendo visibles ventas de otros clubs' || chr(10);
  ELSE
    v_result := v_result || '✅ OK: Solo ventas de tu club son visibles' || chr(10);
  END IF;

  IF EXISTS (SELECT 1 FROM public.promotions WHERE club_id != v_my_club_id) THEN
    v_result := v_result || '⚠️ PROBLEMA: Siguen siendo visibles promociones de otros clubs' || chr(10);
  ELSE
    v_result := v_result || '✅ OK: Solo promociones de tu club son visibles' || chr(10);
  END IF;

  RETURN v_result;
END;
$$;

-- ========================================
-- INSTRUCCIONES
-- ========================================

/*
🚀 IMMEDIATE SIMPLE FIX APLICADO

PARA VERIFICAR QUE FUNCIONÓ:
SELECT fn_quick_check();

Este fix:
✅ Elimina todas las políticas RLS problemáticas
✅ Crea políticas ultra-simples con lógica directa
✅ No depende de funciones auxiliares que puedan fallar
✅ Usa consultas IN directas para máxima claridad

Si después de ejecutar esto sigues viendo datos de otros clubs,
el problema podría estar en:
1. Cache del frontend
2. Consultas que usan service_role inadecuadamente
3. Alguna vista o función que bypasea RLS

EJECUTA: SELECT fn_quick_check();
para confirmar que el fix funcionó.
*/