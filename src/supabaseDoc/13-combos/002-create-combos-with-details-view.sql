-- ===========================================================
-- CREAR VISTA combos_with_details
-- ===========================================================
-- Esta vista agrega detalles calculados a los combos

-- Eliminar vista si existe
DROP VIEW IF EXISTS public.combos_with_details CASCADE;

-- Crear vista con detalles
CREATE OR REPLACE VIEW public.combos_with_details AS
SELECT
  c.id,
  c.club_id,
  c.name,
  c.description,
  c.combo_price,
  c.status,
  c.priority,
  c.max_combo_per_client,
  c.created_by,
  c.updated_by,
  c.created_at,
  c.updated_at,

  -- Agregar items del combo
  (
    SELECT json_agg(
      json_build_object(
        'product_id', ci.product_id,
        'quantity', ci.quantity_per_combo,
        'product_name', p.name,
        'product_price', p.sale_price
      )
    )
    FROM public.combo_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.combo_id = c.id
  ) as combo_items,

  -- Precio total original (suma de precios de productos)
  (
    SELECT COALESCE(SUM(p.sale_price * ci.quantity_per_combo), 0)
    FROM public.combo_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.combo_id = c.id
  ) as original_total_price,

  -- Ahorro en pesos
  (
    SELECT COALESCE(SUM(p.sale_price * ci.quantity_per_combo), 0) - c.combo_price
    FROM public.combo_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.combo_id = c.id
  ) as savings_amount,

  -- Ahorro en porcentaje
  (
    SELECT CASE
      WHEN SUM(p.sale_price * ci.quantity_per_combo) > 0 THEN
        ROUND(((SUM(p.sale_price * ci.quantity_per_combo) - c.combo_price) / SUM(p.sale_price * ci.quantity_per_combo) * 100)::numeric, 2)
      ELSE 0
    END
    FROM public.combo_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.combo_id = c.id
  ) as savings_percentage,

  -- Stock efectivo (el mínimo entre todos los productos del combo)
  (
    SELECT COALESCE(MIN(
      FLOOR(ps.available_stock::numeric / ci.quantity_per_combo::numeric)
    ), 0)
    FROM public.combo_items ci
    LEFT JOIN public.product_stock ps ON ps.product_id = ci.product_id
    WHERE ci.combo_id = c.id
  ) as effective_stock,

  -- Disponibilidad
  CASE
    WHEN c.status = 'inactive' THEN false
    WHEN (
      SELECT COALESCE(MIN(
        FLOOR(ps.available_stock::numeric / ci.quantity_per_combo::numeric)
      ), 0)
      FROM public.combo_items ci
      LEFT JOIN public.product_stock ps ON ps.product_id = ci.product_id
      WHERE ci.combo_id = c.id
    ) <= 0 THEN false
    ELSE true
  END as is_available

FROM public.combos c;

-- Habilitar RLS
ALTER VIEW public.combos_with_details SET (security_invoker = on);

-- Comentarios
COMMENT ON VIEW public.combos_with_details IS 'Vista de combos con detalles calculados: precio original, ahorros, stock efectivo, etc.';

-- Verificación
SELECT
  id,
  name,
  combo_price,
  original_total_price,
  savings_amount,
  savings_percentage,
  effective_stock,
  is_available
FROM public.combos_with_details
LIMIT 5;
