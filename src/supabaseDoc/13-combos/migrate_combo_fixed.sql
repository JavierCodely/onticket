-- =========================================================================
-- MIGRACIÓN COMPLETA DE COMBOS: ELIMINAR STOCK MANUAL Y CÁLCULO DINÁMICO
-- =========================================================================
-- VERSIÓN CORREGIDA PARA POSTGRESQL/SUPABASE

-- ========================================
-- PASO 1: ELIMINAR FUNCIONES EXISTENTES
-- ========================================

DROP FUNCTION IF EXISTS public.fn_create_combo(text, numeric, jsonb, text, integer, integer, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_combo(uuid, text, text, numeric, integer, integer, integer, integer, combo_status) CASCADE;
DROP FUNCTION IF EXISTS public.fn_validate_combo_stock(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.fn_use_combo(uuid, integer, uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_get_combo_stats(date, date) CASCADE;

-- ========================================
-- PASO 2: ELIMINAR Y RECREAR VISTA
-- ========================================

DROP VIEW IF EXISTS public.combos_with_details CASCADE;

-- ========================================
-- PASO 3: MODIFICAR TABLA COMBOS
-- ========================================

-- Verificar si las columnas existen antes de eliminarlas
DO $$
BEGIN
    -- Eliminar stock_quantity si existe
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'combos' AND column_name = 'stock_quantity' AND table_schema = 'public') THEN
        ALTER TABLE public.combos DROP COLUMN stock_quantity CASCADE;
    END IF;

    -- Eliminar min_stock_alert si existe
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'combos' AND column_name = 'min_stock_alert' AND table_schema = 'public') THEN
        ALTER TABLE public.combos DROP COLUMN min_stock_alert CASCADE;
    END IF;

    -- Eliminar current_uses si existe
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'combos' AND column_name = 'current_uses' AND table_schema = 'public') THEN
        ALTER TABLE public.combos DROP COLUMN current_uses CASCADE;
    END IF;

    -- Renombrar max_uses a total_usage_limit si existe
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'combos' AND column_name = 'max_uses' AND table_schema = 'public') THEN
        ALTER TABLE public.combos RENAME COLUMN max_uses TO total_usage_limit;
    END IF;

    -- Agregar max_quantity_per_sale si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'combos' AND column_name = 'max_quantity_per_sale' AND table_schema = 'public') THEN
        ALTER TABLE public.combos ADD COLUMN max_quantity_per_sale integer NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Limpiar constraints obsoletos
DO $$
BEGIN
    -- Eliminar constraints relacionados con columnas eliminadas
    ALTER TABLE public.combos DROP CONSTRAINT IF EXISTS combos_stock_quantity_check;
    ALTER TABLE public.combos DROP CONSTRAINT IF EXISTS combos_min_stock_alert_check;
    ALTER TABLE public.combos DROP CONSTRAINT IF EXISTS combos_current_uses_check;
    ALTER TABLE public.combos DROP CONSTRAINT IF EXISTS combos_max_uses_check;

    -- Agregar nuevos constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE table_name = 'combos' AND constraint_name = 'combos_total_usage_limit_check') THEN
        ALTER TABLE public.combos ADD CONSTRAINT combos_total_usage_limit_check
        CHECK (total_usage_limit IS NULL OR total_usage_limit > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE table_name = 'combos' AND constraint_name = 'combos_max_quantity_per_sale_check') THEN
        ALTER TABLE public.combos ADD CONSTRAINT combos_max_quantity_per_sale_check
        CHECK (max_quantity_per_sale > 0);
    END IF;
END $$;

-- ========================================
-- PASO 4: CREAR NUEVA VISTA
-- ========================================

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

  -- Stock bajo (effective_stock <= 5)
  CASE
    WHEN COUNT(ci.id) > 0 THEN
      COALESCE(
        MIN(FLOOR(COALESCE(ps.available_stock, 0) / GREATEST(ci.quantity_per_combo, 1))),
        0
      ) <= 5
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

ALTER VIEW public.combos_with_details SET (security_invoker = true);

-- ========================================
-- PASO 5: RECREAR FUNCIONES
-- ========================================

-- Función para crear combo
CREATE OR REPLACE FUNCTION public.fn_create_combo(
  p_name text,
  p_combo_price numeric,
  p_combo_items jsonb,
  p_description text DEFAULT NULL,
  p_min_combo_per_client integer DEFAULT 1,
  p_max_combo_per_client integer DEFAULT 1,
  p_max_quantity_per_sale integer DEFAULT 1,
  p_total_usage_limit integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo_id uuid;
  v_club_id uuid;
  v_item jsonb;
  v_display_order integer := 0;
BEGIN
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden crear combos';
  END IF;

  IF p_combo_price <= 0 THEN
    RAISE EXCEPTION 'El precio del combo debe ser mayor a 0';
  END IF;

  IF p_min_combo_per_client <= 0 THEN
    RAISE EXCEPTION 'El mínimo por cliente debe ser mayor a 0';
  END IF;

  IF p_max_combo_per_client < p_min_combo_per_client THEN
    RAISE EXCEPTION 'El máximo por cliente debe ser mayor o igual al mínimo';
  END IF;

  IF p_max_quantity_per_sale <= 0 THEN
    RAISE EXCEPTION 'El máximo por venta debe ser mayor a 0';
  END IF;

  IF jsonb_array_length(p_combo_items) < 2 THEN
    RAISE EXCEPTION 'Un combo debe tener al menos 2 productos';
  END IF;

  INSERT INTO public.combos (
    club_id, name, description, combo_price,
    min_combo_per_client, max_combo_per_client,
    max_quantity_per_sale, total_usage_limit,
    created_by, updated_by
  ) VALUES (
    v_club_id, p_name, p_description, p_combo_price,
    p_min_combo_per_client, p_max_combo_per_client,
    p_max_quantity_per_sale, p_total_usage_limit,
    auth.uid(), auth.uid()
  ) RETURNING id INTO v_combo_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_combo_items)
  LOOP
    IF (v_item->>'quantity_per_combo')::integer <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0 para el producto %', v_item->>'product_id';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE id = (v_item->>'product_id')::uuid
        AND club_id = v_club_id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Producto % no encontrado o inactivo', v_item->>'product_id';
    END IF;

    INSERT INTO public.combo_items (
      combo_id, product_id, quantity_per_combo, display_order
    ) VALUES (
      v_combo_id, (v_item->>'product_id')::uuid,
      (v_item->>'quantity_per_combo')::integer, v_display_order
    );

    v_display_order := v_display_order + 1;
  END LOOP;

  RETURN v_combo_id;
END;
$$;

-- Función para actualizar combo
CREATE OR REPLACE FUNCTION public.fn_update_combo(
  p_combo_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_combo_price numeric DEFAULT NULL,
  p_min_combo_per_client integer DEFAULT NULL,
  p_max_combo_per_client integer DEFAULT NULL,
  p_max_quantity_per_sale integer DEFAULT NULL,
  p_total_usage_limit integer DEFAULT NULL,
  p_status combo_status DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_combo record;
BEGIN
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden actualizar combos';
  END IF;

  SELECT * INTO v_combo FROM public.combos
  WHERE id = p_combo_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Combo no encontrado';
  END IF;

  IF p_combo_price IS NOT NULL AND p_combo_price <= 0 THEN
    RAISE EXCEPTION 'El precio del combo debe ser mayor a 0';
  END IF;

  IF p_min_combo_per_client IS NOT NULL AND p_min_combo_per_client <= 0 THEN
    RAISE EXCEPTION 'El mínimo por cliente debe ser mayor a 0';
  END IF;

  IF p_max_quantity_per_sale IS NOT NULL AND p_max_quantity_per_sale <= 0 THEN
    RAISE EXCEPTION 'El máximo por venta debe ser mayor a 0';
  END IF;

  UPDATE public.combos SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    combo_price = COALESCE(p_combo_price, combo_price),
    min_combo_per_client = COALESCE(p_min_combo_per_client, min_combo_per_client),
    max_combo_per_client = COALESCE(p_max_combo_per_client, max_combo_per_client),
    max_quantity_per_sale = COALESCE(p_max_quantity_per_sale, max_quantity_per_sale),
    total_usage_limit = CASE
      WHEN p_total_usage_limit = -1 THEN NULL
      ELSE COALESCE(p_total_usage_limit, total_usage_limit)
    END,
    status = COALESCE(p_status, status),
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_combo_id;

  RETURN TRUE;
END;
$$;

-- Función para validar stock
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

  IF v_combo.status != 'active' THEN
    v_errors := array_append(v_errors, 'El combo no está activo');
  END IF;

  SELECT COALESCE(SUM(combo_quantity), 0) INTO v_current_uses
  FROM public.combo_usage_log WHERE combo_id = p_combo_id;

  IF v_combo.total_usage_limit IS NOT NULL AND (v_current_uses + p_combo_quantity) > v_combo.total_usage_limit THEN
    v_errors := array_append(v_errors, 'Límite de usos totales excedido');
  END IF;

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

-- Función para usar combo
CREATE OR REPLACE FUNCTION public.fn_use_combo(
  p_combo_id uuid,
  p_combo_quantity integer DEFAULT 1,
  p_sale_id uuid DEFAULT NULL,
  p_customer_identifier text DEFAULT NULL,
  p_employee_name text DEFAULT 'Sistema'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_combo record;
  v_item record;
  v_validation_result jsonb;
BEGIN
  v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());
  IF v_club_id IS NULL THEN
    RETURN false;
  END IF;

  v_validation_result := fn_validate_combo_stock(p_combo_id, p_combo_quantity);
  IF NOT (v_validation_result->>'valid')::boolean THEN
    RAISE EXCEPTION 'Validación fallida: %', v_validation_result->>'errors';
  END IF;

  SELECT * INTO v_combo FROM public.combos
  WHERE id = p_combo_id AND club_id = v_club_id;

  FOR v_item IN
    SELECT ci.*, p.name
    FROM public.combo_items ci
    LEFT JOIN public.products p ON p.id = ci.product_id AND p.club_id = v_club_id
    WHERE ci.combo_id = p_combo_id
  LOOP
    PERFORM fn_update_product_stock(
      v_item.product_id,
      v_item.quantity_per_combo * p_combo_quantity
    );
  END LOOP;

  INSERT INTO public.combo_usage_log (
    combo_id, sale_id, customer_identifier, employee_id, employee_name,
    combo_quantity, unit_price, total_price
  ) VALUES (
    p_combo_id, p_sale_id, p_customer_identifier, auth.uid(), p_employee_name,
    p_combo_quantity, v_combo.combo_price, v_combo.combo_price * p_combo_quantity
  );

  RETURN true;
END;
$$;

-- Función de estadísticas
CREATE OR REPLACE FUNCTION public.fn_get_combo_stats(
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_stats jsonb;
BEGIN
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden ver estadísticas';
  END IF;

  SELECT jsonb_build_object(
    'total_combos', (SELECT COUNT(*) FROM public.combos WHERE club_id = v_club_id),
    'active_combos', (SELECT COUNT(*) FROM public.combos WHERE club_id = v_club_id AND status = 'active'),
    'paused_combos', (SELECT COUNT(*) FROM public.combos WHERE club_id = v_club_id AND status = 'paused'),
    'low_stock_combos', (SELECT COUNT(*) FROM public.combos_with_details WHERE club_id = v_club_id AND is_low_stock = true),
    'period_stats', jsonb_build_object(
      'total_sales', COALESCE(SUM(cul.combo_quantity), 0),
      'total_revenue', COALESCE(SUM(cul.total_price), 0),
      'avg_combo_price', COALESCE(AVG(cul.unit_price), 0)
    )
  ) INTO v_stats
  FROM public.combo_usage_log cul
  JOIN public.combos c ON c.id = cul.combo_id
  WHERE c.club_id = v_club_id
    AND DATE(cul.usage_date) BETWEEN p_start_date AND p_end_date;

  RETURN v_stats;
END;
$$;

-- ========================================
-- VERIFICACIÓN FINAL
-- ========================================

SELECT '✅ Estructura de tabla combos:' as resultado;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'combos' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT '✅ Test de vista combos_with_details:' as resultado;
SELECT id, name, status, effective_stock, current_uses, is_available, is_low_stock
FROM public.combos_with_details
ORDER BY created_at DESC
LIMIT 3;

SELECT '🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE' as resultado;