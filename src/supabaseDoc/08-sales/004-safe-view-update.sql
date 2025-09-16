-- ===========================================================
-- ACTUALIZACIÓN SEGURA DE VISTA - SIN DROP CASCADE
-- ===========================================================
-- Este archivo actualiza la vista sales_with_details de forma segura
-- sin romper las dependencias existentes.

-- 01) Primero, actualizar la función fn_get_today_sales para que no dependa de la vista
-- Vamos a recrearla para que use directamente las tablas

CREATE OR REPLACE FUNCTION public.fn_get_today_sales()
RETURNS TABLE(
  -- Campos de sales
  id uuid,
  club_id uuid,
  sale_number text,
  sale_date timestamptz,
  employee_id uuid,
  employee_name text,
  subtotal numeric,
  discount_amount numeric,
  tax_amount numeric,
  total_amount numeric,
  payment_method payment_method,
  payment_details jsonb,
  status sale_status,
  notes text,
  refund_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  -- Campos adicionales
  employee_full_name text,
  employee_category text,
  items_count bigint,
  items jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.club_id,
    s.sale_number,
    s.sale_date,
    s.employee_id,
    s.employee_name,
    s.subtotal,
    s.discount_amount,
    s.tax_amount,
    s.total_amount,
    s.payment_method,
    s.payment_details,
    s.status,
    s.notes,
    s.refund_reason,
    s.created_at,
    s.updated_at,
    e.full_name as employee_full_name,
    e.category as employee_category,
    COUNT(si.id) as items_count,
    ARRAY_AGG(
      jsonb_build_object(
        'id', si.id,
        'product_id', si.product_id,
        'product_name', si.product_name,
        'product_sku', si.product_sku,
        'quantity', si.quantity,
        'unit_price', si.unit_price,
        'line_total', si.line_total,
        'created_at', si.created_at
      ) ORDER BY si.created_at
    ) as items
  FROM public.sales s
  LEFT JOIN public.employees e ON e.user_id = s.employee_id
  LEFT JOIN public.sale_items si ON si.sale_id = s.id
  WHERE s.club_id = COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id())
    AND DATE(s.sale_date) = CURRENT_DATE
  GROUP BY s.id, s.club_id, s.sale_number, s.sale_date, s.employee_id, s.employee_name,
           s.subtotal, s.discount_amount, s.tax_amount, s.total_amount, s.payment_method,
           s.payment_details, s.status, s.notes, s.refund_reason, s.created_at, s.updated_at,
           e.full_name, e.category
  ORDER BY s.sale_date DESC;
$$;

-- 02) Ahora podemos actualizar la vista de forma segura
CREATE OR REPLACE VIEW public.sales_with_details AS
SELECT
  s.*,
  e.full_name as employee_full_name,
  e.category as employee_category,
  COUNT(si.id) as items_count,
  ARRAY_AGG(
    jsonb_build_object(
      'id', si.id,                    -- ID real del sale_item (UUID)
      'product_id', si.product_id,    -- ID real del producto (UUID)
      'product_name', si.product_name,
      'product_sku', si.product_sku,
      'quantity', si.quantity,
      'unit_price', si.unit_price,
      'line_total', si.line_total,
      'created_at', si.created_at
    ) ORDER BY si.created_at
  ) as items
FROM public.sales s
LEFT JOIN public.employees e ON e.user_id = s.employee_id
LEFT JOIN public.sale_items si ON si.sale_id = s.id
GROUP BY s.id, e.full_name, e.category;

-- 02.1) Mantener RLS en la vista
ALTER VIEW public.sales_with_details SET (security_invoker = on);

-- 03) Verificar que la función fn_get_sales_stats existe
-- Si no existe, crearla

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
      -- Métodos de pago
      payment_stats AS (
        SELECT
          payment_method,
          COUNT(*) as count,
          SUM(total_amount) as amount
        FROM public.sales
        WHERE club_id = v_club_id
          AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
          AND status = 'completed'
        GROUP BY payment_method
      ),
      -- Top empleados
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
      -- Ventas por hora
      hourly_stats AS (
        SELECT
          EXTRACT(HOUR FROM sale_date) as hour,
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
      SELECT jsonb_object_agg(
        payment_method,
        jsonb_build_object(
          'count', count,
          'amount', amount
        )
      ) INTO v_payment_methods
      FROM payment_stats;

      -- Construir top empleados
      SELECT jsonb_agg(
        jsonb_build_object(
          'employee_name', employee_name,
          'count', count,
          'amount', amount
        )
      ) INTO v_top_employees
      FROM employee_stats;

      -- Construir ventas por hora
      SELECT jsonb_agg(
        jsonb_build_object(
          'hour', hour,
          'count', count,
          'amount', amount
        )
      ) INTO v_hourly_sales
      FROM hourly_stats;

      -- Construir resultado final
      SELECT jsonb_build_object(
        'total_sales', total_sales,
        'total_amount', total_amount,
        'average_sale', avg_sale_amount,
        'employees_count', employees_count,
        'payment_methods', COALESCE(v_payment_methods, '{}')::jsonb,
        'top_employees', COALESCE(v_top_employees, '[]')::jsonb,
        'hourly_sales', COALESCE(v_hourly_sales, '[]')::jsonb
      ) INTO v_stats
      FROM basic_stats;

      RETURN v_stats;
    END;
    $func$;

  END IF;
END
$$;

-- 04) Verificar que todas las funciones necesarias existen
SELECT
  required_functions.function_name,
  CASE
    WHEN r.routine_name IS NOT NULL THEN '✅ Existe'
    ELSE '❌ Falta'
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

-- 05) Verificar que la vista se actualizó correctamente
SELECT
  'Vista actualizada correctamente' as message,
  COUNT(*) as sales_count
FROM public.sales_with_details
LIMIT 1;

-- 06) Probar que la nueva estructura funciona
SELECT
  sale_number,
  items_count,
  (items->0->>'id') as first_item_id,
  (items->0->>'product_id') as first_product_id,
  CASE
    WHEN (items->0->>'id') LIKE '________-____-____-____-____________' THEN '✅ UUID válido'
    ELSE '❌ No es UUID'
  END as id_validation
FROM public.sales_with_details
WHERE items_count > 0
LIMIT 1;

-- 07) Comentario final
/*
ACTUALIZACIÓN COMPLETADA EXITOSAMENTE

✅ fn_get_today_sales actualizada para no depender de la vista
✅ sales_with_details actualizada con IDs reales sin conflictos
✅ fn_get_sales_stats verificada/creada
✅ Todas las dependencias mantenidas

SIGUIENTE PASO:
- Refrescar aplicación (F5)
- Probar edición de ventas
- Los errores de UUID deberían estar resueltos
*/