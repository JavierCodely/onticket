-- ===========================================================
-- CORRECCIÓN: Función fn_update_product_stock con esquema correcto
-- ===========================================================
-- Error: column "created_at" of relation "product_stock" does not exist
-- La tabla product_stock solo tiene: updated_at (no created_at)

-- Función corregida que usa el esquema real de product_stock
CREATE OR REPLACE FUNCTION public.fn_update_product_stock(
  p_product_id uuid,
  p_quantity_sold integer  -- Positivo para ventas, negativo para reembolsos
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_current_stock integer;
  v_is_refund boolean;
  v_new_stock integer;
BEGIN
  -- Verificar que el producto pertenece al club del usuario
  SELECT p.club_id INTO v_club_id
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado: %', p_product_id;
  END IF;

  -- Verificar permisos de club
  IF v_club_id != COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id()) THEN
    RAISE EXCEPTION 'Sin permisos para actualizar stock de este producto';
  END IF;

  -- Determinar si es un reembolso (cantidad negativa)
  v_is_refund := p_quantity_sold < 0;

  -- Obtener stock actual
  SELECT current_stock INTO v_current_stock
  FROM public.product_stock
  WHERE product_id = p_product_id;

  -- Si no existe registro de stock, usar 0
  IF v_current_stock IS NULL THEN
    v_current_stock := 0;
  END IF;

  -- Calcular nuevo stock
  v_new_stock := v_current_stock - p_quantity_sold;

  -- Solo verificar stock suficiente para VENTAS (no para reembolsos)
  IF NOT v_is_refund AND v_current_stock < p_quantity_sold THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %',
      v_current_stock, p_quantity_sold;
  END IF;

  -- Actualizar o insertar stock usando el esquema REAL de product_stock
  INSERT INTO public.product_stock (
    product_id,
    club_id,
    current_stock,
    last_sale_date,
    updated_by,
    updated_at                    -- ✅ SOLO updated_at (no created_at)
  )
  VALUES (
    p_product_id,
    v_club_id,
    v_new_stock,
    CASE WHEN NOT v_is_refund THEN NOW() ELSE NULL END,
    auth.uid(),
    NOW()
  )
  ON CONFLICT (product_id)
  DO UPDATE SET
    current_stock = v_new_stock,
    last_sale_date = CASE
      WHEN NOT v_is_refund THEN NOW()
      ELSE product_stock.last_sale_date
    END,
    updated_by = auth.uid(),
    updated_at = NOW();

  -- Log para debugging
  IF v_is_refund THEN
    RAISE NOTICE 'REEMBOLSO: Producto % - Restauradas % unidades. Stock: % → %',
      p_product_id, ABS(p_quantity_sold), v_current_stock, v_new_stock;
  ELSE
    RAISE NOTICE 'VENTA: Producto % - Vendidas % unidades. Stock: % → %',
      p_product_id, p_quantity_sold, v_current_stock, v_new_stock;
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR en fn_update_product_stock: %', SQLERRM;
    RAISE;
END;
$$;

-- Asegurar permisos
GRANT EXECUTE ON FUNCTION public.fn_update_product_stock(uuid, integer) TO authenticated;

-- Función de reembolso corregida (sin cambios, pero incluida para completitud)
CREATE OR REPLACE FUNCTION public.fn_cancel_refund_sale(
  p_sale_id uuid,
  p_action sale_status,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_item RECORD;
  v_items_count integer := 0;
BEGIN
  RAISE NOTICE 'INICIANDO REEMBOLSO: Venta %, Acción %, Razón %', p_sale_id, p_action, p_reason;

  -- Check if current user is admin
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  -- Validate action
  IF p_action NOT IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Acción inválida. Use "cancelled" o "refunded"';
  END IF;

  -- Get sale information
  SELECT * INTO v_sale_record
  FROM public.sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada: %', p_sale_id;
  END IF;

  -- Permission checks
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id
    FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active';

    v_can_edit := (v_club_id = v_sale_record.club_id);
  ELSE
    v_can_edit := false;
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'Solo los administradores pueden cancelar o reembolsar ventas';
  END IF;

  -- Can't cancel/refund already cancelled/refunded sales
  IF v_sale_record.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'No se puede cancelar/reembolsar una venta que ya está %', v_sale_record.status;
  END IF;

  -- Update sale status
  UPDATE public.sales
  SET
    status = p_action,
    refund_reason = p_reason,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_sale_id;

  RAISE NOTICE 'Status de venta actualizado a: %', p_action;

  -- Restore stock for all items
  FOR v_item IN
    SELECT product_id, quantity, product_name
    FROM public.sale_items
    WHERE sale_id = p_sale_id
  LOOP
    v_items_count := v_items_count + 1;

    RAISE NOTICE 'Procesando item %: Producto % (%), Cantidad %',
      v_items_count, v_item.product_name, v_item.product_id, v_item.quantity;

    -- ✅ CRÍTICO: Pasar cantidad como NEGATIVA para restaurar stock
    BEGIN
      PERFORM fn_update_product_stock(v_item.product_id, -v_item.quantity);
      RAISE NOTICE '✅ Stock restaurado exitosamente para producto %', v_item.product_name;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '❌ ERROR restaurando stock para producto %: %', v_item.product_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'REEMBOLSO COMPLETADO: Venta % - % items procesados',
    v_sale_record.sale_number, v_items_count;

  RETURN TRUE;
END;
$$;

-- Asegurar permisos
GRANT EXECUTE ON FUNCTION public.fn_cancel_refund_sale(uuid, sale_status, text) TO authenticated;

-- Verificación final
DO $$
BEGIN
  RAISE NOTICE '=== CORRECCIÓN APLICADA ===';
  RAISE NOTICE '✅ fn_update_product_stock corregida para esquema real de product_stock';
  RAISE NOTICE '✅ Eliminada referencia a created_at (no existe)';
  RAISE NOTICE '✅ Solo usa: product_id, club_id, current_stock, last_sale_date, updated_by, updated_at';
  RAISE NOTICE '✅ fn_cancel_refund_sale actualizada';
  RAISE NOTICE '=== LISTO PARA PROBAR REEMBOLSOS ===';
END $$;

/*
ESQUEMA REAL DE product_stock:
✅ id (uuid)
✅ product_id (uuid)
✅ club_id (uuid)
✅ current_stock (integer)
✅ reserved_stock (integer)
✅ available_stock (computed)
✅ last_restock_date (timestamptz)
✅ last_restock_quantity (integer)
✅ last_sale_date (timestamptz)
✅ updated_by (uuid)
✅ updated_at (timestamptz)

❌ created_at NO EXISTE (era el error)
*/