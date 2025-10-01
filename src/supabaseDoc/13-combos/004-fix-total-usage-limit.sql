-- =========================================================================
-- FIX: CORRECCIÓN DEL LÍMITE TOTAL DE USOS EN COMBOS
-- =========================================================================
-- Este script diagnostica y corrige problemas con el contador de usos
-- y la verificación del límite total de usos en los combos.

-- ========================================
-- PASO 1: DIAGNÓSTICO
-- ========================================

SELECT '🔍 DIAGNÓSTICO DEL SISTEMA DE COMBOS' as mensaje;

-- Verificar estructura de la tabla combos
SELECT '📋 Estructura de la tabla combos:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'combos' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar combos con límite y sus usos actuales
SELECT '📊 Estado actual de combos con límite:' as info;
SELECT
  c.id,
  c.name,
  c.status,
  c.total_usage_limit,
  COALESCE(SUM(cul.combo_quantity), 0) as usos_calculados_desde_log,
  CASE
    WHEN c.total_usage_limit IS NULL THEN 'Sin límite'
    WHEN COALESCE(SUM(cul.combo_quantity), 0) >= c.total_usage_limit THEN '🔴 LÍMITE ALCANZADO'
    ELSE '🟢 Disponible'
  END as estado_limite
FROM public.combos c
LEFT JOIN public.combo_usage_log cul ON cul.combo_id = c.id
WHERE c.status = 'active'
GROUP BY c.id, c.name, c.status, c.total_usage_limit
ORDER BY c.created_at DESC;

-- Verificar la vista combos_with_details
SELECT '🔍 Verificando vista combos_with_details:' as info;
SELECT
  id,
  name,
  status,
  total_usage_limit,
  current_uses,
  effective_stock,
  is_available,
  CASE
    WHEN total_usage_limit IS NOT NULL AND current_uses >= total_usage_limit THEN '🔴 LÍMITE ALCANZADO (debería estar no disponible)'
    WHEN total_usage_limit IS NULL THEN '♾️ Sin límite'
    ELSE '🟢 Dentro del límite'
  END as estado_detallado
FROM public.combos_with_details
WHERE status = 'active'
ORDER BY created_at DESC;

-- ========================================
-- PASO 2: VERIFICAR Y RECREAR VISTA SI ES NECESARIO
-- ========================================

-- Eliminar y recrear la vista para asegurar que tenga el cálculo correcto
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

  -- ✅ USOS ACTUALES calculados desde el log (CAMPO CRÍTICO)
  COALESCE(usage_stats.current_uses, 0) as current_uses,

  -- ✅ VALIDACIÓN DE DISPONIBILIDAD (incluye verificación de límite total)
  CASE
    -- Combo no activo
    WHEN c.status != 'active' THEN false

    -- Algún producto del combo no está disponible o sin stock
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

    -- ⚠️ LÍMITE TOTAL DE USOS ALCANZADO (VALIDACIÓN CRÍTICA)
    WHEN c.total_usage_limit IS NOT NULL AND COALESCE(usage_stats.current_uses, 0) >= c.total_usage_limit THEN false

    -- Stock efectivo es 0
    WHEN COALESCE(
      MIN(FLOOR(COALESCE(ps.available_stock, 0) / GREATEST(ci.quantity_per_combo, 1))),
      0
    ) <= 0 THEN false

    -- Todo OK, combo disponible
    ELSE true
  END as is_available,

  -- Stock bajo (effective_stock <= 2)
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

-- ✅ LEFT JOIN CRÍTICO: Calcular usos actuales desde el log
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

COMMENT ON VIEW public.combos_with_details IS 'Vista de combos con detalles calculados: precios, stock, usos actuales y validación de límite total';

-- ========================================
-- PASO 3: VERIFICAR FUNCIÓN fn_validate_combo_stock
-- ========================================

-- Recrear función de validación para asegurar que verifica el límite
CREATE OR REPLACE FUNCTION public.fn_validate_combo_stock(
  p_combo_id uuid,
  p_combo_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_combo record;
  v_item record;
  v_validation_result jsonb := '{"valid": true, "errors": []}'::jsonb;
  v_errors text[] := '{}';
  v_current_uses integer := 0;
BEGIN
  v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());
  IF v_club_id IS NULL THEN
    RETURN '{"valid": false, "errors": ["Sin permisos para validar combos"]}'::jsonb;
  END IF;

  SELECT * INTO v_combo FROM public.combos
  WHERE id = p_combo_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RETURN '{"valid": false, "errors": ["Combo no encontrado"]}'::jsonb;
  END IF;

  -- ✅ Validar estado del combo
  IF v_combo.status != 'active' THEN
    v_errors := array_append(v_errors, 'El combo no está activo');
  END IF;

  -- ✅ VALIDACIÓN CRÍTICA: Calcular usos actuales y verificar límite total
  SELECT COALESCE(SUM(combo_quantity), 0) INTO v_current_uses
  FROM public.combo_usage_log WHERE combo_id = p_combo_id;

  IF v_combo.total_usage_limit IS NOT NULL AND (v_current_uses + p_combo_quantity) > v_combo.total_usage_limit THEN
    v_errors := array_append(v_errors,
      format('Límite de usos totales excedido (actual: %s, límite: %s, solicitado: %s)',
        v_current_uses, v_combo.total_usage_limit, p_combo_quantity));
  END IF;

  -- Validar stock de productos individuales
  FOR v_item IN
    SELECT ci.*, p.name, ps.available_stock
    FROM public.combo_items ci
    LEFT JOIN public.products p ON p.id = ci.product_id AND p.club_id = v_club_id
    LEFT JOIN public.product_stock ps ON ps.product_id = ci.product_id AND ps.club_id = v_club_id
    WHERE ci.combo_id = p_combo_id
  LOOP
    IF v_item.available_stock IS NULL OR v_item.available_stock < (v_item.quantity_per_combo * p_combo_quantity) THEN
      v_errors := array_append(v_errors,
        'Stock insuficiente de ' || COALESCE(v_item.name, 'producto') ||
        ' (necesario: ' || (v_item.quantity_per_combo * p_combo_quantity) ||
        ', disponible: ' || COALESCE(v_item.available_stock, 0) || ')');
    END IF;
  END LOOP;

  IF array_length(v_errors, 1) > 0 THEN
    v_validation_result := jsonb_build_object('valid', false, 'errors', to_jsonb(v_errors));
  END IF;

  RETURN v_validation_result;
END;
$$;

-- ========================================
-- PASO 4: VERIFICACIÓN FINAL
-- ========================================

SELECT '✅ VERIFICACIÓN FINAL - Estado de combos después de la corrección:' as info;

SELECT
  id,
  name,
  status,
  total_usage_limit,
  current_uses,
  effective_stock,
  is_available,
  CASE
    WHEN total_usage_limit IS NOT NULL AND current_uses >= total_usage_limit THEN
      '🔴 LÍMITE ALCANZADO (' || current_uses || '/' || total_usage_limit || ')'
    WHEN total_usage_limit IS NOT NULL THEN
      '🟢 Disponible (' || current_uses || '/' || total_usage_limit || ')'
    ELSE
      '♾️ Sin límite (' || current_uses || ' usos)'
  END as estado_limite,
  CASE
    WHEN is_available THEN '✅ Disponible'
    ELSE '❌ No disponible'
  END as disponibilidad
FROM public.combos_with_details
WHERE status = 'active'
ORDER BY created_at DESC;

-- Mostrar combos que deberían estar no disponibles por límite
SELECT '⚠️ COMBOS QUE ALCANZARON EL LÍMITE (deberían estar is_available = false):' as info;

SELECT
  id,
  name,
  total_usage_limit,
  current_uses,
  is_available,
  CASE
    WHEN is_available = false THEN '✅ Correctamente marcado como no disponible'
    ELSE '❌ ERROR: Debería estar no disponible'
  END as verificacion
FROM public.combos_with_details
WHERE status = 'active'
  AND total_usage_limit IS NOT NULL
  AND current_uses >= total_usage_limit;

SELECT '🎉 CORRECCIÓN COMPLETADA' as resultado;
