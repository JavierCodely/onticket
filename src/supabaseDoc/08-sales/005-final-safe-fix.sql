-- ===========================================================
-- FIX FINAL SEGURO - SIN CAMBIAR TIPOS DE RETORNO
-- ===========================================================
-- Este archivo actualiza solo lo necesario sin tocar fn_get_today_sales

-- 01) Simplemente actualizar la vista existente con CREATE OR REPLACE
-- Esto debería funcionar porque solo agregamos campos al JSON, no cambiamos la estructura base

CREATE OR REPLACE VIEW public.sales_with_details AS
SELECT
  s.*,
  e.full_name as employee_full_name,
  e.category as employee_category,
  COUNT(si.id) as items_count,
  ARRAY_AGG(
    jsonb_build_object(
      'id', si.id,                    -- ✅ ID real del sale_item
      'product_id', si.product_id,    -- ✅ ID real del producto
      'product_name', si.product_name,
      'product_sku', si.product_sku,  -- ✅ SKU incluido
      'quantity', si.quantity,
      'unit_price', si.unit_price,
      'line_total', si.line_total,
      'created_at', si.created_at     -- ✅ Timestamp incluido
    ) ORDER BY si.created_at
  ) as items
FROM public.sales s
LEFT JOIN public.employees e ON e.user_id = s.employee_id
LEFT JOIN public.sale_items si ON si.sale_id = s.id
GROUP BY s.id, e.full_name, e.category;

-- 01.1) Mantener RLS
ALTER VIEW public.sales_with_details SET (security_invoker = on);

-- 02) Crear fn_get_sales_stats solo si no existe (sin tocar si ya existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'fn_get_sales_stats'
    AND routine_schema = 'public'
  ) THEN

    CREATE FUNCTION public.fn_get_sales_stats(
      p_start_date date DEFAULT CURRENT_DATE,
      p_end_date date DEFAULT CURRENT_DATE
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    DECLARE
      v_club_id uuid;
      v_stats jsonb;
      v_payment_methods jsonb;
      v_top_employees jsonb;
      v_hourly_sales jsonb;
    BEGIN
      -- Obtener club_id del usuario actual
      v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());

      IF v_club_id IS NULL THEN
        RETURN '{
          "total_sales": 0,
          "total_amount": 0,
          "average_sale": 0,
          "employees_count": 0,
          "payment_methods": {},
          "top_employees": [],
          "hourly_sales": []
        }'::jsonb;
      END IF;

      -- Estadísticas básicas
      WITH basic_stats AS (
        SELECT
          COUNT(*) as total_sales,
          COALESCE(SUM(total_amount), 0) as total_amount,
          COALESCE(AVG(total_amount), 0) as avg_sale_amount,
          COUNT(DISTINCT employee_name) as employees_count
        FROM public.sales
        WHERE club_id = v_club_id
          AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
          AND status = 'completed'
      ),
      payment_stats AS (
        SELECT
          payment_method::text,
          COUNT(*) as count,
          SUM(total_amount) as amount
        FROM public.sales
        WHERE club_id = v_club_id
          AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
          AND status = 'completed'
        GROUP BY payment_method
      ),
      employee_stats AS (
        SELECT
          employee_name,
          COUNT(*) as count,
          SUM(total_amount) as amount
        FROM public.sales
        WHERE club_id = v_club_id
          AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
          AND status = 'completed'
        GROUP BY employee_name
        ORDER BY amount DESC
        LIMIT 5
      ),
      hourly_stats AS (
        SELECT
          EXTRACT(HOUR FROM sale_date)::int as hour,
          COUNT(*) as count,
          SUM(total_amount) as amount
        FROM public.sales
        WHERE club_id = v_club_id
          AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
          AND status = 'completed'
        GROUP BY EXTRACT(HOUR FROM sale_date)
        ORDER BY hour
      )

      -- Construir métodos de pago
      SELECT COALESCE(
        jsonb_object_agg(
          payment_method,
          jsonb_build_object(
            'count', count,
            'amount', amount
          )
        ),
        '{}'::jsonb
      ) INTO v_payment_methods
      FROM payment_stats;

      -- Construir top empleados
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'employee_name', employee_name,
            'count', count,
            'amount', amount
          )
        ),
        '[]'::jsonb
      ) INTO v_top_employees
      FROM employee_stats;

      -- Construir ventas por hora
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'hour', hour,
            'count', count,
            'amount', amount
          )
        ),
        '[]'::jsonb
      ) INTO v_hourly_sales
      FROM hourly_stats;

      -- Construir resultado final
      SELECT jsonb_build_object(
        'total_sales', total_sales,
        'total_amount', total_amount,
        'average_sale', avg_sale_amount,
        'employees_count', employees_count,
        'payment_methods', v_payment_methods,
        'top_employees', v_top_employees,
        'hourly_sales', v_hourly_sales
      ) INTO v_stats
      FROM basic_stats;

      RETURN v_stats;
    END;
    $func$;

    RAISE NOTICE '✅ fn_get_sales_stats creada exitosamente';
  ELSE
    RAISE NOTICE '✅ fn_get_sales_stats ya existe';
  END IF;
END
$$;

-- 03) Verificar que tenemos todas las funciones de edición
-- (deberían estar del archivo 002-sales-edit-schema.sql)

SELECT
  required_functions.function_name,
  CASE
    WHEN r.routine_name IS NOT NULL THEN '✅ Existe'
    ELSE '❌ Falta - Aplicar 002-sales-edit-schema.sql'
  END as status
FROM (
  VALUES
    ('fn_update_sale'),
    ('fn_add_sale_item'),
    ('fn_update_sale_item'),
    ('fn_remove_sale_item'),
    ('fn_cancel_refund_sale'),
    ('fn_get_sales_stats'),
    ('fn_create_sale'),
    ('fn_get_today_sales')
) AS required_functions(function_name)
LEFT JOIN information_schema.routines r
  ON r.routine_name = required_functions.function_name
  AND r.routine_schema = 'public'
ORDER BY required_functions.function_name;

-- 04) Probar la nueva estructura de la vista
SELECT
  'Prueba de vista actualizada' as test,
  sale_number,
  items_count,
  (items->0->>'id') as first_item_id,
  (items->0->>'product_id') as first_product_id,
  CASE
    WHEN (items->0->>'id') IS NOT NULL AND
         (items->0->>'product_id') IS NOT NULL THEN '✅ IDs incluidos'
    ELSE '❌ Faltan IDs'
  END as validation_result
FROM public.sales_with_details
WHERE items_count > 0
LIMIT 1;

-- 05) Verificar políticas RLS para edición
SELECT
  tablename,
  policyname,
  cmd,
  CASE
    WHEN policyname LIKE '%admin%' AND cmd = 'UPDATE' THEN '✅ Admin puede editar'
    WHEN policyname LIKE '%admin%' AND cmd = 'DELETE' THEN '✅ Admin puede eliminar'
    WHEN cmd = 'SELECT' THEN '✅ Lectura disponible'
    ELSE '📝 ' || cmd
  END as description
FROM pg_policies
WHERE tablename IN ('sales', 'sale_items')
  AND (policyname LIKE '%update%' OR policyname LIKE '%delete%' OR policyname LIKE '%admin%')
ORDER BY tablename, cmd;

-- 06) Comentario final
/*
🎯 ACTUALIZACIÓN MÍNIMA APLICADA

✅ Vista sales_with_details actualizada con IDs reales
✅ fn_get_sales_stats creada si no existía
✅ No se tocó fn_get_today_sales (evitar conflictos)
✅ Verificaciones incluidas

ERRORES QUE SE SOLUCIONAN:
❌ "invalid input syntax for type uuid: 'item-0'"
✅ Ahora items tienen IDs reales de sale_items

❌ "fn_get_sales_stats 404 Not Found"
✅ Función creada y disponible

SIGUIENTE PASO:
1. Refrescar aplicación (F5)
2. Ir a Ventas → Editar una venta
3. Los cambios ahora deberían guardarse correctamente

NOTA: Si faltan las funciones de edición (fn_update_sale, etc.),
aplicar también: 002-sales-edit-schema.sql
*/