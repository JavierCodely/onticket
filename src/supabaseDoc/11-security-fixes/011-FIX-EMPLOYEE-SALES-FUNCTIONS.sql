-- ===========================================================
-- 🔧 FIX: FUNCIONES DE VENTAS PARA EMPLEADOS
-- ===========================================================
-- PROBLEMA: fn_get_employee_today_sales no existe o no funciona
-- SOLUCIÓN: Recrear funciones de empleados con la nueva arquitectura

-- ========================================
-- PASO 1: VERIFICAR Y CREAR FUNCIÓN fn_current_employee_club_id
-- ========================================

-- Crear o reemplazar función para obtener club_id del empleado actual
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
-- PASO 2: RECREAR FUNCIONES DE VENTAS PARA EMPLEADOS
-- ========================================

-- Función para obtener ventas del día (para empleados)
CREATE OR REPLACE FUNCTION public.fn_get_employee_today_sales()
RETURNS SETOF public.sales_with_details
LANGUAGE sql
SECURITY INVOKER  -- ✅ CAMBIO: Usar INVOKER en lugar de DEFINER para que respete RLS
SET search_path = public
AS $$
  SELECT *
  FROM public.sales_with_details
  WHERE DATE(sale_date) = CURRENT_DATE
  ORDER BY sale_date DESC;
$$;

-- Función para obtener estadísticas de ventas del empleado
CREATE OR REPLACE FUNCTION public.fn_get_employee_sales_stats(
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER  -- ✅ CAMBIO: Usar INVOKER en lugar de DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  -- La vista sales_with_details ya filtra por club automáticamente
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
    'employee_sales', jsonb_object_agg(
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

  RETURN COALESCE(v_stats, '{"total_sales": 0, "total_amount": 0, "avg_sale_amount": 0}'::jsonb);
END;
$$;

-- ========================================
-- PASO 3: FUNCIÓN PARA CREAR VENTA (EMPLEADOS)
-- ========================================

-- Función simplificada para que empleados puedan crear ventas
CREATE OR REPLACE FUNCTION public.fn_employee_create_sale(
  p_items jsonb,                        -- Array de items: [{"product_id": "uuid", "quantity": 2, "unit_price": 10.50}]
  p_payment_method text,                -- Método de pago
  p_payment_details jsonb DEFAULT NULL, -- Detalles del pago
  p_discount_amount numeric DEFAULT 0,  -- Descuento
  p_notes text DEFAULT NULL             -- Notas
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER  -- Necesario para crear registros
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_club_id uuid;
  v_employee_club_id uuid;
  v_current_user_id uuid;
  v_employee_name text;
BEGIN
  -- Obtener info del empleado actual
  v_current_user_id := auth.uid();

  SELECT e.club_id, e.full_name
  INTO v_employee_club_id, v_employee_name
  FROM public.employees e
  WHERE e.user_id = v_current_user_id AND e.status = 'active';

  IF v_employee_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo empleados activos pueden crear ventas';
  END IF;

  -- Llamar a la función principal de creación de ventas
  v_sale_id := fn_create_sale(
    v_current_user_id,    -- employee_user_id
    v_employee_name,      -- employee_name
    p_items,              -- items
    p_payment_method::payment_method,  -- payment_method
    p_payment_details,    -- payment_details
    p_discount_amount,    -- discount_amount
    p_notes               -- notes
  );

  RETURN v_sale_id;
END;
$$;

-- ========================================
-- PASO 4: FUNCIÓN DE VERIFICACIÓN
-- ========================================

-- Función para verificar que las funciones de empleados funcionan
CREATE OR REPLACE FUNCTION public.fn_verify_employee_functions()
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
  v_user_id uuid;
  v_employee_club_id uuid;
  v_is_employee boolean;
  v_sales_count integer;
  v_stats jsonb;
BEGIN
  v_user_id := auth.uid();

  -- Test 1: Verificar si el usuario es empleado
  SELECT e.club_id INTO v_employee_club_id
  FROM public.employees e
  WHERE e.user_id = v_user_id AND e.status = 'active';

  v_is_employee := v_employee_club_id IS NOT NULL;

  RETURN QUERY SELECT
    'employee_authentication'::text,
    CASE WHEN v_is_employee THEN '✅ PASS' ELSE '❌ FAIL' END::text,
    ('Usuario ID: ' || COALESCE(v_user_id::text, 'NULL') ||
     ', Es empleado: ' || v_is_employee ||
     ', Club ID: ' || COALESCE(v_employee_club_id::text, 'NULL'))::text;

  IF NOT v_is_employee THEN
    RETURN QUERY SELECT
      'employee_functions_test'::text,
      '⚠️ SKIP'::text,
      'No se puede probar: usuario no es empleado activo'::text;
    RETURN;
  END IF;

  -- Test 2: Probar función de ventas del día
  BEGIN
    SELECT COUNT(*) INTO v_sales_count FROM fn_get_employee_today_sales();

    RETURN QUERY SELECT
      'fn_get_employee_today_sales'::text,
      '✅ PASS'::text,
      ('Función ejecutada correctamente. Ventas del día: ' || v_sales_count)::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'fn_get_employee_today_sales'::text,
      '❌ FAIL'::text,
      ('Error: ' || SQLERRM)::text;
  END;

  -- Test 3: Probar función de estadísticas
  BEGIN
    SELECT fn_get_employee_sales_stats() INTO v_stats;

    RETURN QUERY SELECT
      'fn_get_employee_sales_stats'::text,
      '✅ PASS'::text,
      ('Función ejecutada correctamente. Stats: ' || v_stats::text)::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'fn_get_employee_sales_stats'::text,
      '❌ FAIL'::text,
      ('Error: ' || SQLERRM)::text;
  END;

END;
$$;

-- ========================================
-- PASO 5: GRANTS PARA EMPLEADOS
-- ========================================

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.fn_get_employee_today_sales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_employee_sales_stats(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_employee_create_sale(jsonb, text, jsonb, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_current_employee_club_id() TO authenticated;

-- ========================================
-- INSTRUCCIONES DE USO
-- ========================================

/*
🔧 FUNCIONES DE EMPLEADOS RECREADAS

FUNCIONES DISPONIBLES:
✅ fn_get_employee_today_sales() - Ventas del día para empleados
✅ fn_get_employee_sales_stats() - Estadísticas de ventas
✅ fn_employee_create_sale() - Crear venta como empleado
✅ fn_current_employee_club_id() - Obtener club del empleado actual

PARA VERIFICAR QUE FUNCIONAN:
SELECT * FROM fn_verify_employee_functions();

CAMBIOS IMPORTANTES:
- Las funciones ahora usan SECURITY INVOKER para respetar RLS
- Dependen de la vista sales_with_details que ya filtra por club
- fn_employee_create_sale permite a empleados crear ventas
- Todos los permisos otorgados a usuarios autenticados

PARA EMPLEADOS:
- Ahora pueden ver solo ventas de su club
- Pueden crear ventas usando fn_employee_create_sale
- Las estadísticas son específicas de su club
*/