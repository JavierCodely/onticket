-- ========================================
-- AGREGAR COLUMNA DETAILS A TABLA SALES
-- ========================================
-- Columna para almacenar detalles adicionales de la venta:
-- - Descuentos manuales aplicados por el empleado
-- - Promociones aplicadas con sus detalles
-- - Información de combos utilizados
-- - Otros detalles relevantes de la venta

-- Agregar la columna details como JSONB
ALTER TABLE public.sales
ADD COLUMN details jsonb DEFAULT NULL;

-- Crear un índice GIN para consultas eficientes en el campo JSONB
CREATE INDEX sales_details_gin_idx ON public.sales USING gin (details);

-- Comentario de la columna para documentación
COMMENT ON COLUMN public.sales.details IS 'Detalles adicionales de la venta en formato JSON: descuentos manuales, promociones aplicadas, combos, etc.';

-- ========================================
-- ESTRUCTURA ESPERADA DEL CAMPO DETAILS
-- ========================================
/*
Estructura del campo details (jsonb):
{
  "discounts": {
    "manual_discount": {
      "applied": true,
      "amount": 10.50,
      "reason": "Cliente frecuente",
      "applied_by": "Juan Perez"
    }
  },
  "promotions": [
    {
      "promotion_id": "uuid-promocion",
      "promotion_name": "2x1 en cervezas",
      "promotion_type": "combo",
      "discount_amount": 15.00,
      "original_price": 30.00,
      "final_price": 15.00,
      "products_affected": [
        {
          "product_id": "uuid-producto",
          "product_name": "Cerveza Corona",
          "quantity": 2
        }
      ]
    }
  ],
  "combos": [
    {
      "combo_name": "Combo Noche",
      "combo_items": [
        {
          "product_id": "uuid-producto-1",
          "product_name": "Whisky",
          "quantity": 1
        },
        {
          "product_id": "uuid-producto-2",
          "product_name": "Hielo",
          "quantity": 1
        }
      ],
      "combo_price": 45.00,
      "individual_price": 60.00,
      "savings": 15.00
    }
  ],
  "special_conditions": {
    "employee_sale": true,
    "vip_customer": false,
    "special_event": "Noche de apertura"
  },
  "payment_details": {
    "tip_included": true,
    "tip_amount": 5.00,
    "service_charge": 2.50
  }
}
*/

-- ========================================
-- ACTUALIZAR VISTA SALES_WITH_DETAILS
-- ========================================

-- Primero eliminamos la vista existente
DROP VIEW IF EXISTS public.sales_with_details;

-- Recreamos la vista incluyendo el nuevo campo details
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
GROUP BY s.id, a.full_name, e.full_name, e.category, a.user_id, e.user_id;

-- ========================================
-- FUNCIONES AUXILIARES PARA DETAILS
-- ========================================

-- Función para extraer información de descuentos del campo details
CREATE OR REPLACE FUNCTION public.fn_get_sale_discount_details(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_details jsonb;
  v_discount_info jsonb;
BEGIN
  -- Obtener el campo details de la venta
  SELECT details INTO v_details
  FROM public.sales
  WHERE id = p_sale_id;

  -- Extraer información de descuentos
  v_discount_info := jsonb_build_object(
    'manual_discount', COALESCE(v_details->'discounts'->'manual_discount', '{}'::jsonb),
    'promotion_discounts', COALESCE(v_details->'promotions', '[]'::jsonb),
    'total_savings', COALESCE((v_details->'combos'->0->>'savings')::numeric, 0)
  );

  RETURN v_discount_info;
END;
$$;

-- Función para extraer información de promociones del campo details
CREATE OR REPLACE FUNCTION public.fn_get_sale_promotions_details(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_details jsonb;
BEGIN
  -- Obtener el campo details de la venta
  SELECT COALESCE(details->'promotions', '[]'::jsonb) INTO v_details
  FROM public.sales
  WHERE id = p_sale_id;

  RETURN v_details;
END;
$$;

-- Función para extraer información de combos del campo details
CREATE OR REPLACE FUNCTION public.fn_get_sale_combos_details(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_details jsonb;
BEGIN
  -- Obtener el campo details de la venta
  SELECT COALESCE(details->'combos', '[]'::jsonb) INTO v_details
  FROM public.sales
  WHERE id = p_sale_id;

  RETURN v_details;
END;
$$;

-- ========================================
-- EJEMPLOS DE USO
-- ========================================
/*
-- Ejemplo 1: Venta con descuento manual
UPDATE public.sales
SET details = jsonb_build_object(
  'discounts', jsonb_build_object(
    'manual_discount', jsonb_build_object(
      'applied', true,
      'amount', 5.00,
      'reason', 'Cliente frecuente',
      'applied_by', 'Juan Perez'
    )
  )
)
WHERE id = 'uuid-venta';

-- Ejemplo 2: Venta con promoción aplicada
UPDATE public.sales
SET details = jsonb_build_object(
  'promotions', jsonb_build_array(
    jsonb_build_object(
      'promotion_id', 'uuid-promocion',
      'promotion_name', '2x1 en bebidas',
      'promotion_type', 'percentage',
      'discount_amount', 10.00,
      'original_price', 20.00,
      'final_price', 10.00
    )
  )
)
WHERE id = 'uuid-venta';

-- Ejemplo 3: Consultar detalles de descuentos
SELECT fn_get_sale_discount_details('uuid-venta');

-- Ejemplo 4: Buscar ventas con descuentos manuales
SELECT * FROM sales_with_details
WHERE details->'discounts'->'manual_discount'->>'applied' = 'true';

-- Ejemplo 5: Buscar ventas con promociones específicas
SELECT * FROM sales_with_details
WHERE details->'promotions' @> '[{"promotion_type": "combo"}]';
*/