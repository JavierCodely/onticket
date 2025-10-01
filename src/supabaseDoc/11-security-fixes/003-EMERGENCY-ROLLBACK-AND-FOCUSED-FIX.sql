-- ===========================================================
-- 🚨 EMERGENCY ROLLBACK + FOCUSED FIX
-- ===========================================================
-- PROBLEMA: El script anterior causó recursión infinita
-- SOLUCIÓN: Restaurar políticas originales que funcionaban + fix específico
--
-- ⚠️ EJECUTAR INMEDIATAMENTE PARA RESTAURAR FUNCIONALIDAD

-- ========================================
-- PASO 1: EMERGENCY ROLLBACK - RESTAURAR POLÍTICAS ORIGINALES
-- ========================================

-- 1.1) RESTAURAR POLÍTICAS DE EMPLOYEES (ELIMINAR RECURSIÓN)
DROP POLICY IF EXISTS employees_admin_manage_strict ON public.employees;
DROP POLICY IF EXISTS employees_admin_update_strict ON public.employees;
DROP POLICY IF EXISTS employees_self_and_coworkers_strict ON public.employees;
DROP POLICY IF EXISTS employees_self_update_limited_strict ON public.employees;

-- Restaurar políticas originales de employees que funcionaban
CREATE POLICY employees_select_my_club_admin
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id()
  );

CREATE POLICY employees_update_my_club_admin
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id()
  )
  WITH CHECK (
    club_id = fn_current_admin_club_id()
  );

CREATE POLICY employees_select_self
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'active'
  );

CREATE POLICY employees_update_self_limited
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'active'
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- 1.2) RESTAURAR POLÍTICAS DE PRODUCTS (ELIMINAR RECURSIÓN)
DROP POLICY IF EXISTS products_admin_all ON public.products;
DROP POLICY IF EXISTS products_employee_select_strict ON public.products;

-- Restaurar políticas originales de products que funcionaban
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

-- 1.3) RESTAURAR POLÍTICAS DE PRODUCT_STOCK
DROP POLICY IF EXISTS product_stock_admin_all ON public.product_stock;
DROP POLICY IF EXISTS product_stock_employee_limited ON public.product_stock;
DROP POLICY IF EXISTS product_stock_employee_update_strict ON public.product_stock;

-- Restaurar políticas originales de product_stock
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
-- PASO 2: RESTAURAR FUNCIONES DE SEGURIDAD ORIGINALES
-- ========================================

-- Restaurar función original de fn_current_admin_club_id (sin recursión)
CREATE OR REPLACE FUNCTION public.fn_current_admin_club_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.club_id
  FROM public.admins a
  WHERE a.user_id = auth.uid()
    AND a.status = 'active'
  LIMIT 1;
$$;

-- Restaurar función original de fn_current_employee_club_id (sin recursión)
CREATE OR REPLACE FUNCTION public.fn_current_employee_club_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.club_id
  FROM public.employees e
  WHERE e.user_id = auth.uid()
    AND e.status = 'active'
  LIMIT 1;
$$;

-- ========================================
-- PASO 3: FIX ESPECÍFICO SOLO PARA SALES Y PROMOTIONS
-- ========================================

-- 3.1) CORREGIR SOLO POLÍTICAS DE SALES (EL PROBLEMA REAL)
DROP POLICY IF EXISTS sales_admin_all_strict ON public.sales;
DROP POLICY IF EXISTS sales_employee_select_strict ON public.sales;

-- Políticas corregidas para sales (más estrictas pero sin recursión)
CREATE POLICY sales_admin_select_fixed
  ON public.sales
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id()
    AND fn_current_admin_club_id() IS NOT NULL
  );

CREATE POLICY sales_admin_insert_fixed
  ON public.sales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id = fn_current_admin_club_id()
    AND fn_current_admin_club_id() IS NOT NULL
  );

CREATE POLICY sales_admin_update_fixed
  ON public.sales
  FOR UPDATE
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id()
    AND fn_current_admin_club_id() IS NOT NULL
  )
  WITH CHECK (
    club_id = fn_current_admin_club_id()
    AND fn_current_admin_club_id() IS NOT NULL
  );

CREATE POLICY sales_admin_delete_fixed
  ON public.sales
  FOR DELETE
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id()
    AND fn_current_admin_club_id() IS NOT NULL
  );

-- 3.2) CORREGIR SOLO POLÍTICAS DE SALE_ITEMS
DROP POLICY IF EXISTS sale_items_admin_all_strict ON public.sale_items;
DROP POLICY IF EXISTS sale_items_employee_select_strict ON public.sale_items;

CREATE POLICY sale_items_admin_select_fixed
  ON public.sale_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
        AND fn_current_admin_club_id() IS NOT NULL
    )
  );

CREATE POLICY sale_items_admin_insert_fixed
  ON public.sale_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
        AND fn_current_admin_club_id() IS NOT NULL
    )
  );

CREATE POLICY sale_items_admin_update_fixed
  ON public.sale_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
        AND fn_current_admin_club_id() IS NOT NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
        AND fn_current_admin_club_id() IS NOT NULL
    )
  );

CREATE POLICY sale_items_admin_delete_fixed
  ON public.sale_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
        AND fn_current_admin_club_id() IS NOT NULL
    )
  );

-- 3.3) CORREGIR SOLO POLÍTICAS DE PROMOTIONS
DROP POLICY IF EXISTS promotions_admin_all_strict ON public.promotions;
DROP POLICY IF EXISTS promotions_employee_select_strict ON public.promotions;

CREATE POLICY promotions_admin_select_fixed
  ON public.promotions
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id()
    AND fn_current_admin_club_id() IS NOT NULL
  );

CREATE POLICY promotions_admin_insert_fixed
  ON public.promotions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id = fn_current_admin_club_id()
    AND fn_current_admin_club_id() IS NOT NULL
  );

CREATE POLICY promotions_admin_update_fixed
  ON public.promotions
  FOR UPDATE
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id()
    AND fn_current_admin_club_id() IS NOT NULL
  )
  WITH CHECK (
    club_id = fn_current_admin_club_id()
    AND fn_current_admin_club_id() IS NOT NULL
  );

CREATE POLICY promotions_admin_delete_fixed
  ON public.promotions
  FOR DELETE
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id()
    AND fn_current_admin_club_id() IS NOT NULL
  );

CREATE POLICY promotions_employee_select_fixed
  ON public.promotions
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    AND fn_current_employee_club_id() IS NOT NULL
    AND status = 'active'
  );

-- 3.4) CORREGIR SOLO POLÍTICAS DE PROMOTION_ITEMS
DROP POLICY IF EXISTS promotion_items_admin_all_strict ON public.promotion_items;
DROP POLICY IF EXISTS promotion_items_employee_select_strict ON public.promotion_items;

CREATE POLICY promotion_items_admin_all_fixed
  ON public.promotion_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.promotions pr
      WHERE pr.id = promotion_items.promotion_id
        AND pr.club_id = fn_current_admin_club_id()
        AND fn_current_admin_club_id() IS NOT NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.promotions pr
      WHERE pr.id = promotion_items.promotion_id
        AND pr.club_id = fn_current_admin_club_id()
        AND fn_current_admin_club_id() IS NOT NULL
    )
  );

CREATE POLICY promotion_items_employee_select_fixed
  ON public.promotion_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.promotions pr
      WHERE pr.id = promotion_items.promotion_id
        AND pr.club_id = fn_current_employee_club_id()
        AND fn_current_employee_club_id() IS NOT NULL
        AND pr.status = 'active'
    )
  );

-- ========================================
-- PASO 4: VERIFICAR QUE NO HAY RECURSIÓN
-- ========================================

-- Función simple para verificar que todo funciona
CREATE OR REPLACE FUNCTION public.fn_test_no_recursion()
RETURNS TABLE (
  test_name text,
  result text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'admin_club_id'::text,
    COALESCE(fn_current_admin_club_id()::text, 'NULL')::text;

  RETURN QUERY
  SELECT
    'employee_club_id'::text,
    COALESCE(fn_current_employee_club_id()::text, 'NULL')::text;

  RETURN QUERY
  SELECT
    'employees_count'::text,
    (SELECT COUNT(*)::text FROM public.employees LIMIT 1);

  RETURN QUERY
  SELECT
    'products_count'::text,
    (SELECT COUNT(*)::text FROM public.products LIMIT 1);

  RETURN QUERY
  SELECT
    'sales_count'::text,
    (SELECT COUNT(*)::text FROM public.sales LIMIT 1);

  RETURN QUERY
  SELECT
    'promotions_count'::text,
    (SELECT COUNT(*)::text FROM public.promotions LIMIT 1);
END;
$$;

-- ========================================
-- COMENTARIOS DE RECUPERACIÓN
-- ========================================

/*
🚨 EMERGENCY ROLLBACK APLICADO

QUE SE HIZO:
✅ Eliminadas políticas que causaban recursión infinita
✅ Restauradas políticas originales de employees (que funcionaban)
✅ Restauradas políticas originales de products (que funcionaban)
✅ Restauradas políticas originales de product_stock (que funcionaban)
✅ Restauradas funciones originales sin recursión
✅ Aplicado fix ESPECÍFICO solo a sales y promotions (el problema real)
✅ Agregada función de test para verificar que no hay recursión

POLÍTICAS CORREGIDAS ESPECÍFICAMENTE:
- Sales: Agregada validación IS NOT NULL en todas las operaciones
- Sale_items: Validación estricta con EXISTS y IS NOT NULL
- Promotions: Agregada validación IS NOT NULL en todas las operaciones
- Promotion_items: Validación estricta con EXISTS y IS NOT NULL

VERIFICACIÓN:
1. Ejecutar: SELECT * FROM fn_test_no_recursion();
2. Verificar que employees funciona (no más error 500)
3. Verificar que products funciona (no más error 500)
4. Verificar que sales aparecen SOLO del club correcto
5. Verificar que promotions aparecen SOLO del club correcto

RESULTADO ESPERADO:
- Employees: ✅ Funcionando sin recursión
- Products: ✅ Funcionando sin recursión
- Sales: ✅ Solo del club correcto
- Promotions: ✅ Solo del club correcto
*/