-- =========================================================================
-- FIX: CORRECCIÓN DEL CÁLCULO DE STOCK BAJO EN COMBOS
-- =========================================================================
-- El cálculo actual considera stock bajo cuando effective_stock <= 5
-- Esto es demasiado conservador y causa advertencias innecesarias.
-- Nueva lógica: stock bajo solo cuando effective_stock <= 2

-- ========================================
-- RECREAR VISTA CON CÁLCULO CORREGIDO
-- ========================================

DROP VIEW IF EXISTS public.combos_with_details CASCADE;

CREATE OR REPLACE VIEW public.combos_with_details AS
SELECT
  c.id,
  c.club_id,
  c.name,
  c.description,
  c.combo_price,
  c.min_combo_per_client,
  c.max_combo_per_client,
  c.max_quantity_per_sale,
  c.total_usage_limit,
  c.status,
  c.priority,
  c.created_by,
  c.updated_by,
  c.created_at,
  c.updated_at,

  -- Array de items del combo
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', ci.product_id,
        'product_name', COALESCE(p.name, 'Producto ' || ci.product_id),
        'product_sku', p.sku,
        'product_category', p.category,
        'quantity_per_combo', ci.quantity_per_combo,
        'unit_price', COALESCE(p.sale_price, 0),
        'total_price_per_combo', COALESCE(p.sale_price, 0) * ci.quantity_per_combo,
        'available_stock', COALESCE(ps.available_stock, 0),
        'display_order', ci.display_order
      ) ORDER BY ci.display_order
    ) FILTER (WHERE ci.id IS NOT NULL),
    '[]'::jsonb
  ) as combo_items,

  -- Cálculos de precios
  COALESCE(SUM(COALESCE(p.sale_price, 0) * ci.quantity_per_combo), 0) as original_total_price,
  COALESCE(SUM(COALESCE(p.sale_price, 0) * ci.quantity_per_combo), 0) - c.combo_price as savings_amount,

  -- Porcentaje de ahorro
  CASE
    WHEN COALESCE(SUM(COALESCE(p.sale_price, 0) * ci.quantity_per_combo), 0) > 0 THEN
      ROUND(
        ((COALESCE(SUM(COALESCE(p.sale_price, 0) * ci.quantity_per_combo), 0) - c.combo_price) /
         COALESCE(SUM(COALESCE(p.sale_price, 0) * ci.quantity_per_combo), 1) * 100), 2
      )
    ELSE 0
  END as savings_percentage,

  -- Stock disponible calculado dinámicamente
  CASE
    WHEN COUNT(ci.id) > 0 THEN
      COALESCE(
        MIN(FLOOR(COALESCE(ps.available_stock, 0) / GREATEST(ci.quantity_per_combo, 1))),
        0
      )
    ELSE 0
  END as effective_stock,

  -- Usos actuales calculados desde el log
  COALESCE(usage_stats.current_uses, 0) as current_uses,

  -- Validación de disponibilidad
  CASE
    WHEN c.status != 'active' THEN false
    WHEN EXISTS (
      SELECT 1
      FROM public.combo_items ci_check
      LEFT JOIN public.products p_check ON p_check.id = ci_check.product_id AND p_check.club_id = c.club_id
      LEFT JOIN public.product_stock ps_check ON ps_check.product_id = ci_check.product_id AND ps_check.club_id = c.club_id
      WHERE ci_check.combo_id = c.id
        AND (
          p_check.id IS NULL OR
          p_check.status != 'active' OR
          COALESCE(ps_check.available_stock, 0) < ci_check.quantity_per_combo
        )
    ) THEN false
    WHEN c.total_usage_limit IS NOT NULL AND COALESCE(usage_stats.current_uses, 0) >= c.total_usage_limit THEN false
    WHEN COALESCE(
      MIN(FLOOR(COALESCE(ps.available_stock, 0) / GREATEST(ci.quantity_per_combo, 1))),
      0
    ) <= 0 THEN false
    ELSE true
  END as is_available,

  -- ✅ CORREGIDO: Stock bajo solo cuando effective_stock <= 2 (en lugar de <= 5)
  CASE
    WHEN COUNT(ci.id) > 0 THEN
      COALESCE(
        MIN(FLOOR(COALESCE(ps.available_stock, 0) / GREATEST(ci.quantity_per_combo, 1))),
        0
      ) <= 2
    ELSE true
  END as is_low_stock,

  -- Contador de productos en el combo
  COUNT(ci.id) as items_count,

  -- Información del creador
  COALESCE(a.full_name, e.full_name, 'Sistema') as created_by_name,
  COALESCE(au.full_name, eu.full_name, 'Sistema') as updated_by_name

FROM public.combos c
LEFT JOIN public.combo_items ci ON ci.combo_id = c.id
LEFT JOIN public.products p ON p.id = ci.product_id AND p.club_id = c.club_id
LEFT JOIN public.product_stock ps ON ps.product_id = ci.product_id AND ps.club_id = c.club_id
LEFT JOIN (
  SELECT
    combo_id,
    SUM(combo_quantity) as current_uses
  FROM public.combo_usage_log
  GROUP BY combo_id
) usage_stats ON usage_stats.combo_id = c.id
LEFT JOIN public.admins a ON a.user_id = c.created_by AND a.club_id = c.club_id
LEFT JOIN public.employees e ON e.user_id = c.created_by AND e.club_id = c.club_id
LEFT JOIN public.admins au ON au.user_id = c.updated_by AND au.club_id = c.club_id
LEFT JOIN public.employees eu ON eu.user_id = c.updated_by AND eu.club_id = c.club_id
GROUP BY
  c.id, c.club_id, c.name, c.description, c.combo_price,
  c.min_combo_per_client, c.max_combo_per_client, c.max_quantity_per_sale,
  c.total_usage_limit, c.status, c.priority, c.created_by, c.updated_by,
  c.created_at, c.updated_at, usage_stats.current_uses,
  a.full_name, e.full_name, au.full_name, eu.full_name;

-- Mantener configuración de seguridad
ALTER VIEW public.combos_with_details SET (security_invoker = true);

-- ========================================
-- VERIFICACIÓN
-- ========================================

SELECT '✅ Vista combos_with_details actualizada con nuevo cálculo de stock bajo (effective_stock <= 2)' as resultado;

-- Mostrar combos con su nuevo estado de stock bajo
SELECT
  id,
  name,
  effective_stock,
  is_low_stock,
  CASE
    WHEN is_low_stock THEN 'STOCK BAJO'
    ELSE 'STOCK OK'
  END as status_mensaje
FROM public.combos_with_details
ORDER BY effective_stock ASC
LIMIT 10;