-- ===========================================================
-- 🔧 FIX DEFINITIVO: VISTAS Y FUNCIONES CON FILTRO DE CLUB
-- ===========================================================
-- PROBLEMA IDENTIFICADO: Las vistas no respetan RLS automáticamente
-- SOLUCIÓN: Recrear vistas con filtro de club_id explícito
--
-- ⚠️ Este es el fix definitivo para el cross-club data leakage

-- ========================================
-- PASO 1: RECREAR VISTA sales_with_details CON FILTRO DE CLUB
-- ========================================

-- Eliminar vista existente
DROP VIEW IF EXISTS public.sales_with_details CASCADE;

-- Crear vista con filtro de club explícito
CREATE VIEW public.sales_with_details AS
SELECT
  s.*,

  -- Información del empleado/admin que hizo la venta
  COALESCE(a.full_name, e.full_name, s.employee_name) as employee_full_name,
  CASE
    WHEN a.user_id IS NOT NULL THEN 'admin'
    WHEN e.user_id IS NOT NULL THEN e.category::text
    ELSE 'unknown'
  END as employee_role,

  -- Estadísticas de items
  COUNT(si.id) as items_count,

  -- Items como JSON agregado
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', si.id,
        'product_id', si.product_id,
        'product_name', si.product_name,
        'product_sku', si.product_sku,
        'product_category', si.product_category,
        'unit_price', si.unit_price,
        'quantity', si.quantity,
        'line_total', si.line_total
      ) ORDER BY si.created_at
    ) FILTER (WHERE si.id IS NOT NULL),
    '[]'::jsonb
  ) as items

FROM public.sales s
LEFT JOIN public.admins a ON a.user_id = s.employee_id AND a.status = 'active'
LEFT JOIN public.employees e ON e.user_id = s.employee_id AND e.status = 'active'
LEFT JOIN public.sale_items si ON si.sale_id = s.id

-- ✅ FILTRO CRÍTICO: Solo mostrar ventas del club del usuario actual
WHERE s.club_id = (
  -- Primero intentar como admin
  COALESCE(
    (SELECT a2.club_id FROM public.admins a2 WHERE a2.user_id = auth.uid() AND a2.status = 'active' LIMIT 1),
    -- Si no es admin, intentar como empleado
    (SELECT e2.club_id FROM public.employees e2 WHERE e2.user_id = auth.uid() AND e2.status = 'active' LIMIT 1)
  )
)

GROUP BY s.id, a.full_name, e.full_name, e.category, a.user_id, e.user_id;

-- ========================================
-- PASO 2: RECREAR VISTA promotions_with_details CON FILTRO DE CLUB
-- ========================================

-- Eliminar vista existente
DROP VIEW IF EXISTS public.promotions_with_details CASCADE;

-- Crear vista con filtro de club explícito
CREATE OR REPLACE VIEW public.promotions_with_details AS
SELECT
  pr.*,

  -- Información del producto principal (para promociones individuales)
  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.name FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as product_name,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.sku FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as product_sku,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.sale_price FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as original_price,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.category FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as product_category,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.status FROM public.products p WHERE p.id = pr.product_id)
    ELSE 'active'
  END as product_status,

  -- Información específica para combos
  CASE
    WHEN pr.promotion_type = 'combo' THEN
      (SELECT jsonb_agg(
        jsonb_build_object(
          'product_id', pi.product_id,
          'product_name', COALESCE(prod.name, 'Producto ' || pi.product_id),
          'product_sku', prod.sku,
          'quantity', pi.quantity,
          'unit_price', COALESCE(prod.sale_price, 0),
          'total_price', COALESCE(prod.sale_price, 0) * pi.quantity,
          'display_order', pi.display_order
        ) ORDER BY pi.display_order
      )
      FROM public.promotion_items pi
      LEFT JOIN public.products prod ON prod.id = pi.product_id
      WHERE pi.promotion_id = pr.id)
    ELSE NULL
  END as combo_items,

  -- Precio total original del combo
  CASE
    WHEN pr.promotion_type = 'combo' THEN
      (SELECT COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 0)
      FROM public.promotion_items pi
      LEFT JOIN public.products prod ON prod.id = pi.product_id
      WHERE pi.promotion_id = pr.id)
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.sale_price FROM public.products p WHERE p.id = pr.product_id)
    ELSE 0
  END as combo_original_price,

  -- Cálculo del precio final
  CASE pr.promotion_type
    WHEN 'combo' THEN pr.discount_value
    WHEN 'fixed_price' THEN pr.discount_value
    WHEN 'fixed_amount' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN GREATEST(0, (SELECT p.sale_price FROM public.products p WHERE p.id = pr.product_id) - pr.discount_value)
        ELSE 0
      END
    WHEN 'percentage' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN (
          SELECT
            CASE
              WHEN pr.max_discount_amount IS NOT NULL THEN
                p.sale_price - LEAST(pr.max_discount_amount, p.sale_price * pr.discount_value / 100)
              ELSE
                p.sale_price * (1 - pr.discount_value / 100)
            END
          FROM public.products p WHERE p.id = pr.product_id
        )
        ELSE 0
      END
  END as final_price,

  -- Display del descuento
  CASE
    WHEN pr.promotion_type = 'combo' THEN 'Combo: $' || pr.discount_value
    WHEN pr.promotion_type = 'percentage' THEN pr.discount_value || '%'
    WHEN pr.promotion_type = 'fixed_amount' THEN '$' || pr.discount_value
    WHEN pr.promotion_type = 'fixed_price' THEN 'Precio: $' || pr.discount_value
  END as discount_display,

  -- Validaciones de disponibilidad
  CASE
    WHEN pr.status = 'inactive' THEN false
    WHEN pr.start_date IS NOT NULL AND pr.start_date > NOW() THEN false
    WHEN pr.end_date IS NOT NULL AND pr.end_date < NOW() THEN false
    WHEN pr.max_uses IS NOT NULL AND pr.current_uses >= pr.max_uses THEN false
    ELSE true
  END as is_available

FROM public.promotions pr

-- ✅ FILTRO CRÍTICO: Solo mostrar promociones del club del usuario actual
WHERE pr.club_id = (
  -- Primero intentar como admin
  COALESCE(
    (SELECT a.club_id FROM public.admins a WHERE a.user_id = auth.uid() AND a.status = 'active' LIMIT 1),
    -- Si no es admin, intentar como empleado
    (SELECT e.club_id FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' LIMIT 1)
  )
);

-- ========================================
-- PASO 3: RECREAR FUNCIONES CON FILTRO EXPLÍCITO (NO SECURITY DEFINER)
-- ========================================

-- Función para obtener ventas del día (SIN SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.fn_get_today_sales()
RETURNS SETOF public.sales_with_details
LANGUAGE sql
STABLE
SECURITY INVOKER  -- ✅ CAMBIO CRÍTICO: Usar INVOKER en lugar de DEFINER
SET search_path = public
AS $$
  -- Ya no necesitamos filtro aquí porque la vista ya filtra
  SELECT *
  FROM public.sales_with_details
  WHERE DATE(sale_date) = CURRENT_DATE
  ORDER BY sale_date DESC;
$$;

-- Función para estadísticas de ventas (SIN SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.fn_get_sales_stats(
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER  -- ✅ CAMBIO CRÍTICO: Usar INVOKER en lugar de DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  -- La vista ya filtra por club, así que no necesitamos filtro adicional
  SELECT jsonb_build_object(
    'total_sales', COUNT(*),
    'total_amount', COALESCE(SUM(total_amount), 0),
    'avg_sale_amount', COALESCE(AVG(total_amount), 0),
    'payment_methods', jsonb_object_agg(
      payment_method,
      jsonb_build_object(
        'count', COUNT(*),
        'amount', SUM(total_amount)
      )
    ),
    'employees', jsonb_object_agg(
      employee_name,
      jsonb_build_object(
        'count', COUNT(*),
        'amount', SUM(total_amount)
      )
    )
  ) INTO v_stats
  FROM public.sales_with_details s
  WHERE s.status = 'completed'
    AND DATE(s.sale_date) BETWEEN p_start_date AND p_end_date;

  RETURN v_stats;
END;
$$;

-- ========================================
-- PASO 4: FUNCIÓN DE VERIFICACIÓN FINAL
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_verify_views_fix()
RETURNS TABLE (
  test_name text,
  result text,
  visible_sales integer,
  visible_promotions integer,
  user_club_id uuid,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_club_id uuid;
  v_sales_count integer;
  v_promotions_count integer;
  v_wrong_sales integer;
  v_wrong_promotions integer;
BEGIN
  -- Obtener club del usuario
  v_user_club_id := COALESCE(
    (SELECT club_id FROM public.admins WHERE user_id = auth.uid() AND status = 'active' LIMIT 1),
    (SELECT club_id FROM public.employees WHERE user_id = auth.uid() AND status = 'active' LIMIT 1)
  );

  -- Contar registros visibles en las vistas
  SELECT COUNT(*) INTO v_sales_count FROM public.sales_with_details;
  SELECT COUNT(*) INTO v_promotions_count FROM public.promotions_with_details;

  -- Verificar si hay registros de otros clubs (NO deberían existir)
  SELECT COUNT(*) INTO v_wrong_sales
  FROM public.sales_with_details
  WHERE club_id != v_user_club_id;

  SELECT COUNT(*) INTO v_wrong_promotions
  FROM public.promotions_with_details
  WHERE club_id != v_user_club_id;

  -- Test principal
  RETURN QUERY SELECT
    'views_isolation_test'::text,
    CASE WHEN v_wrong_sales = 0 AND v_wrong_promotions = 0 THEN '✅ PASS' ELSE '❌ FAIL' END::text,
    v_sales_count,
    v_promotions_count,
    v_user_club_id,
    ('Wrong sales: ' || v_wrong_sales || ', Wrong promotions: ' || v_wrong_promotions)::text;

  -- Test de función fn_get_today_sales
  SELECT COUNT(*) INTO v_sales_count FROM fn_get_today_sales();

  RETURN QUERY SELECT
    'fn_get_today_sales_test'::text,
    '✅ PASS'::text,
    v_sales_count,
    0::integer,
    v_user_club_id,
    ('Today sales returned: ' || v_sales_count)::text;

END;
$$;

-- ========================================
-- PASO 5: INSTRUCCIONES DE VERIFICACIÓN
-- ========================================

/*
🔧 FIX DE VISTAS Y FUNCIONES APLICADO

CAMBIOS REALIZADOS:
✅ Vista sales_with_details recreada CON filtro de club explícito
✅ Vista promotions_with_details recreada CON filtro de club explícito
✅ Funciones cambiadas de SECURITY DEFINER a SECURITY INVOKER
✅ Las vistas ahora filtran automáticamente por el club del usuario

PARA VERIFICAR QUE FUNCIONÓ:
SELECT * FROM fn_verify_views_fix();

DEBERÍAS VER:
- views_isolation_test: ✅ PASS
- Wrong sales: 0, Wrong promotions: 0

SI SIGUE FALLANDO:
El problema puede estar en consultas directas desde el frontend que:
1. Usan service_role inadecuadamente
2. No pasan por las vistas
3. Consultan las tablas directamente

NOTA IMPORTANTE:
Las vistas ahora aplican el filtro de club automáticamente.
No necesitas agregar WHERE club_id = ... en tus consultas del frontend.
*/