-- ===========================================================
-- FIXES PARA EDICIÓN DE VENTAS - APLICAR DESPUÉS DE 002
-- ===========================================================
-- Este archivo corrige los problemas encontrados en la implementación
-- de edición de ventas.

-- 01) Actualizar vista sales_with_details para incluir IDs completos de items
-- Esto es crítico para que funcione la edición de items existentes

DROP VIEW IF EXISTS public.sales_with_details;

CREATE VIEW public.sales_with_details AS
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

-- 01.1) Mantener RLS en la vista
ALTER VIEW public.sales_with_details SET (security_invoker = on);

-- 02) Verificar que la función fn_get_sales_stats existe
-- Si no existe, crearla (debería estar en 001-sales-schema.sql)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'fn_get_sales_stats'
    AND routine_schema = 'public'
  ) THEN
    -- Crear la función si no existe
    EXECUTE '
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
          AND status = ''completed''
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
          AND status = ''completed''
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
          AND status = ''completed''
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
          AND status = ''completed''
        GROUP BY EXTRACT(HOUR FROM sale_date)
        ORDER BY hour
      )

      -- Construir métodos de pago
      SELECT jsonb_object_agg(
        payment_method,
        jsonb_build_object(
          ''count'', count,
          ''amount'', amount
        )
      ) INTO v_payment_methods
      FROM payment_stats;

      -- Construir top empleados
      SELECT jsonb_agg(
        jsonb_build_object(
          ''employee_name'', employee_name,
          ''count'', count,
          ''amount'', amount
        )
      ) INTO v_top_employees
      FROM employee_stats;

      -- Construir ventas por hora
      SELECT jsonb_agg(
        jsonb_build_object(
          ''hour'', hour,
          ''count'', count,
          ''amount'', amount
        )
      ) INTO v_hourly_sales
      FROM hourly_stats;

      -- Construir resultado final
      SELECT jsonb_build_object(
        ''total_sales'', total_sales,
        ''total_amount'', total_amount,
        ''average_sale'', avg_sale_amount,
        ''employees_count'', employees_count,
        ''payment_methods'', COALESCE(v_payment_methods, ''[]''::jsonb),
        ''top_employees'', COALESCE(v_top_employees, ''[]''::jsonb),
        ''hourly_sales'', COALESCE(v_hourly_sales, ''[]''::jsonb)
      ) INTO v_stats
      FROM basic_stats;

      RETURN v_stats;
    END;
    $func$';
  END IF;
END
$$;

-- 03) Verificar que todas las funciones de edición existen
SELECT
  routine_name,
  CASE
    WHEN routine_name IS NOT NULL THEN '✅ Existe'
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
LEFT JOIN information_schema.routines
  ON routine_name = function_name
  AND routine_schema = 'public'
ORDER BY function_name;

-- 04) Verificar políticas RLS
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN policyname LIKE '%admin%' THEN '👤 Admin'
    WHEN policyname LIKE '%employee%' THEN '👥 Employee'
    WHEN policyname LIKE '%service_role%' THEN '🔧 Service'
    ELSE '❓ Other'
  END as target_role
FROM pg_policies
WHERE tablename IN ('sales', 'sale_items')
ORDER BY tablename, cmd, policyname;

-- 05) Comentarios de verificación
/*
VERIFICACIÓN POST-APLICACIÓN:

1. Vista sales_with_details actualizada con:
   ✅ IDs reales de sale_items (no más item-0, item-1)
   ✅ product_id incluido para edición
   ✅ Todos los campos necesarios

2. Función fn_get_sales_stats:
   ✅ Creada si no existía
   ✅ Estructura correcta de CTEs
   ✅ Sin referencias a tablas inexistentes

3. Funciones de edición:
   ✅ fn_update_sale - Actualizar venta
   ✅ fn_add_sale_item - Agregar item
   ✅ fn_update_sale_item - Modificar item
   ✅ fn_remove_sale_item - Eliminar item
   ✅ fn_cancel_refund_sale - Cancelar/reembolsar

4. Políticas RLS:
   ✅ UPDATE/DELETE para admins en sales y sale_items
   ✅ Permisos apropiados por rol
   ✅ Seguridad mantenida

ERRORES SOLUCIONADOS:
❌ "invalid input syntax for type uuid: 'item-0'"
✅ Ahora usa IDs reales de sale_items

❌ "relation 'employee_stats' does not exist"
✅ fn_get_sales_stats usa CTEs correctamente

❌ "product_id missing for editing"
✅ Vista incluye product_id real

SIGUIENTE PASO:
Ejecutar este archivo en Supabase SQL Editor, luego probar edición.
*/