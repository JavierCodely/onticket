-- ========================================
-- FIX: FUNCIONES FALTANTES DEL SISTEMA DE VENTAS
-- ========================================
-- Este archivo crea las funciones que pueden estar faltando
-- para que el sistema funcione correctamente
--
-- EJECUTAR SI HAY ERRORES DE "function not found"
-- ========================================

-- ========================================
-- VERIFICAR Y CREAR FUNCIÓN fn_get_today_sales
-- ========================================

-- Eliminar si existe para recrear
DROP FUNCTION IF EXISTS public.fn_get_today_sales() CASCADE;

-- Crear función para obtener ventas del día
CREATE OR REPLACE FUNCTION public.fn_get_today_sales()
RETURNS SETOF public.sales_with_details
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.sales_with_details
  WHERE club_id = fn_current_admin_club_id()
    AND DATE(sale_date) = CURRENT_DATE
  ORDER BY sale_date DESC;
$$;

-- ========================================
-- VERIFICAR Y CREAR FUNCIÓN fn_get_sales_stats
-- ========================================

-- Eliminar si existe para recrear
DROP FUNCTION IF EXISTS public.fn_get_sales_stats(date, date) CASCADE;

-- Crear función para obtener estadísticas de ventas
CREATE OR REPLACE FUNCTION public.fn_get_sales_stats(
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
  FROM public.sales s
  WHERE s.club_id = v_club_id
    AND s.status = 'completed'
    AND DATE(s.sale_date) BETWEEN p_start_date AND p_end_date;

  RETURN v_stats;
END;
$$;

-- ========================================
-- VERIFICAR Y CREAR FUNCIÓN fn_generate_sale_number
-- ========================================

-- Eliminar si existe para recrear
DROP FUNCTION IF EXISTS public.fn_generate_sale_number(uuid) CASCADE;

-- Crear función para generar número de venta automático
CREATE OR REPLACE FUNCTION public.fn_generate_sale_number(p_club_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_prefix text;
  v_sequence integer;
  v_sale_number text;
BEGIN
  -- Formato: YYYYMMDD-NNNN (ej: 20241217-0001)
  v_date_prefix := to_char(NOW(), 'YYYYMMDD');

  -- Obtener siguiente número secuencial para el día
  SELECT COALESCE(MAX(
    CASE
      WHEN sale_number LIKE v_date_prefix || '-%'
      THEN (split_part(sale_number, '-', 2))::integer
      ELSE 0
    END
  ), 0) + 1
  INTO v_sequence
  FROM public.sales
  WHERE club_id = p_club_id
    AND DATE(sale_date) = CURRENT_DATE;

  v_sale_number := v_date_prefix || '-' || lpad(v_sequence::text, 4, '0');

  RETURN v_sale_number;
END;
$$;

-- ========================================
-- VERIFICAR Y CREAR FUNCIONES DE ITEMS
-- ========================================

-- 1) Función para agregar item a venta
DROP FUNCTION IF EXISTS public.fn_add_sale_item(uuid, uuid, integer, numeric) CASCADE;

CREATE OR REPLACE FUNCTION public.fn_add_sale_item(
  p_sale_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_unit_price numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale record;
  v_product record;
  v_club_id uuid;
  v_item_id uuid;
  v_line_total numeric;
  v_final_price numeric;
BEGIN
  -- Verificar permisos
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden modificar ventas';
  END IF;

  -- Verificar venta
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Verificar producto y stock
  SELECT p.*, COALESCE(ps.available_stock, 0) as available_stock
  INTO v_product
  FROM public.products p
  LEFT JOIN public.product_stock ps ON ps.product_id = p.id
  WHERE p.id = p_product_id
    AND p.club_id = v_club_id
    AND p.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF v_product.available_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente';
  END IF;

  -- Usar precio proporcionado o precio actual del producto
  v_final_price := COALESCE(p_unit_price, v_product.sale_price);
  v_line_total := v_final_price * p_quantity;

  -- Crear item
  INSERT INTO public.sale_items (
    sale_id,
    product_id,
    product_name,
    product_sku,
    product_category,
    unit_price,
    quantity,
    line_total
  ) VALUES (
    p_sale_id,
    p_product_id,
    v_product.name,
    v_product.sku,
    v_product.category::text,
    v_final_price,
    p_quantity,
    v_line_total
  ) RETURNING id INTO v_item_id;

  -- Actualizar totales de la venta
  UPDATE public.sales
  SET
    subtotal = subtotal + v_line_total,
    total_amount = (subtotal + v_line_total) - discount_amount,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_sale_id;

  -- Actualizar stock
  PERFORM fn_update_product_stock(p_product_id, p_quantity);

  RETURN v_item_id;
END;
$$;

-- 2) Función para actualizar item de venta
DROP FUNCTION IF EXISTS public.fn_update_sale_item(uuid, integer, numeric) CASCADE;

CREATE OR REPLACE FUNCTION public.fn_update_sale_item(
  p_item_id uuid,
  p_quantity integer DEFAULT NULL,
  p_unit_price numeric DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_club_id uuid;
  v_old_line_total numeric;
  v_new_line_total numeric;
  v_total_diff numeric;
  v_quantity_diff integer;
BEGIN
  -- Verificar permisos
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden modificar items';
  END IF;

  -- Obtener item y venta
  SELECT si.*, s.club_id, s.sale_number
  INTO v_item
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.id = p_item_id AND s.club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item no encontrado';
  END IF;

  v_old_line_total := v_item.line_total;
  v_quantity_diff := COALESCE(p_quantity, v_item.quantity) - v_item.quantity;

  -- Verificar stock si se aumenta cantidad
  IF v_quantity_diff > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.product_stock ps
      WHERE ps.product_id = v_item.product_id
        AND ps.available_stock >= v_quantity_diff
    ) THEN
      RAISE EXCEPTION 'Stock insuficiente para aumentar cantidad';
    END IF;
  END IF;

  -- Actualizar item
  UPDATE public.sale_items
  SET
    quantity = COALESCE(p_quantity, quantity),
    unit_price = COALESCE(p_unit_price, unit_price),
    line_total = COALESCE(p_unit_price, unit_price) * COALESCE(p_quantity, quantity)
  WHERE id = p_item_id
  RETURNING line_total INTO v_new_line_total;

  v_total_diff := v_new_line_total - v_old_line_total;

  -- Actualizar totales de venta
  UPDATE public.sales
  SET
    subtotal = subtotal + v_total_diff,
    total_amount = (subtotal + v_total_diff) - discount_amount,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = v_item.sale_id;

  -- Actualizar stock
  IF v_quantity_diff != 0 THEN
    PERFORM fn_update_product_stock(v_item.product_id, v_quantity_diff);
  END IF;

  RETURN TRUE;
END;
$$;

-- 3) Función para eliminar item de venta
DROP FUNCTION IF EXISTS public.fn_remove_sale_item(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.fn_remove_sale_item(
  p_item_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_club_id uuid;
BEGIN
  -- Verificar permisos
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden eliminar items';
  END IF;

  -- Obtener item y venta
  SELECT si.*, s.club_id
  INTO v_item
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.id = p_item_id AND s.club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item no encontrado';
  END IF;

  -- Verificar que no sea el último item
  IF (SELECT COUNT(*) FROM public.sale_items WHERE sale_id = v_item.sale_id) = 1 THEN
    RAISE EXCEPTION 'No se puede eliminar el último item de la venta';
  END IF;

  -- Restaurar stock
  PERFORM fn_update_product_stock(v_item.product_id, -v_item.quantity);

  -- Actualizar totales de venta
  UPDATE public.sales
  SET
    subtotal = subtotal - v_item.line_total,
    total_amount = (subtotal - v_item.line_total) - discount_amount,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = v_item.sale_id;

  -- Eliminar item
  DELETE FROM public.sale_items WHERE id = p_item_id;

  RETURN TRUE;
END;
$$;

-- ========================================
-- OTORGAR PERMISOS
-- ========================================

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.fn_get_today_sales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_sales_stats(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_sale_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_add_sale_item(uuid, uuid, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_update_sale_item(uuid, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_remove_sale_item(uuid) TO authenticated;

-- ========================================
-- VERIFICACIÓN FINAL
-- ========================================

DO $$
BEGIN
  -- Verificar que todas las funciones existen
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE specific_schema = 'public'
    AND routine_name = 'fn_get_today_sales'
  ) THEN
    RAISE NOTICE '✅ Función fn_get_today_sales creada correctamente';
  ELSE
    RAISE EXCEPTION '❌ Error: fn_get_today_sales no se creó';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE specific_schema = 'public'
    AND routine_name = 'fn_get_sales_stats'
  ) THEN
    RAISE NOTICE '✅ Función fn_get_sales_stats creada correctamente';
  ELSE
    RAISE EXCEPTION '❌ Error: fn_get_sales_stats no se creó';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE specific_schema = 'public'
    AND routine_name = 'fn_generate_sale_number'
  ) THEN
    RAISE NOTICE '✅ Función fn_generate_sale_number creada correctamente';
  ELSE
    RAISE EXCEPTION '❌ Error: fn_generate_sale_number no se creó';
  END IF;

  RAISE NOTICE '🎉 Todas las funciones del sistema de ventas han sido creadas exitosamente!';
END;
$$;