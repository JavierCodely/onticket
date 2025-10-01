-- ===========================================================
-- CREAR FUNCIÓN DE REEMBOLSO/CANCELACIÓN FALTANTE
-- ===========================================================
-- La función fn_cancel_refund_sale no existe, por eso no funciona el reembolso

-- Función para cancelar o reembolsar venta
CREATE OR REPLACE FUNCTION public.fn_cancel_refund_sale(
  p_sale_id uuid,
  p_action sale_status, -- 'cancelled' or 'refunded'
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
BEGIN
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
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Permission checks
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id
    FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active';

    v_can_edit := (v_club_id = v_sale_record.club_id);
  ELSE
    -- Only admins can cancel/refund sales
    v_can_edit := false;
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'Solo los administradores pueden cancelar o reembolsar ventas';
  END IF;

  -- Can't cancel/refund already cancelled/refunded sales
  IF v_sale_record.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'No se puede cancelar/reembolsar una venta que ya está cancelada o reembolsada';
  END IF;

  -- Update sale status
  UPDATE public.sales
  SET
    status = p_action,
    refund_reason = p_reason,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_sale_id;

  -- Restore stock for all items (CLAVE: valor negativo para restaurar)
  FOR v_item IN
    SELECT product_id, quantity
    FROM public.sale_items
    WHERE sale_id = p_sale_id
  LOOP
    -- ✅ CRÍTICO: Pasar cantidad como NEGATIVA para restaurar stock
    PERFORM fn_update_product_stock(v_item.product_id, -v_item.quantity);

    -- Log para verificar
    RAISE NOTICE 'REEMBOLSO: Restaurando % unidades del producto %',
      v_item.quantity, v_item.product_id;
  END LOOP;

  RAISE NOTICE 'Venta % ha sido % con éxito. Razón: %',
    v_sale_record.sale_number, p_action, p_reason;

  RETURN TRUE;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION public.fn_cancel_refund_sale(uuid, sale_status, text) TO authenticated;

-- Comentario de uso
/*
FUNCIÓN PARA CANCELAR O REEMBOLSAR VENTAS

PARÁMETROS:
- p_sale_id: ID de la venta a cancelar/reembolsar
- p_action: 'cancelled' o 'refunded'
- p_reason: Razón del reembolso/cancelación

VALIDACIONES:
✅ Solo administradores pueden usar esta función
✅ Solo ventas 'completed' pueden ser canceladas/reembolsadas
✅ No se puede reembolsar una venta ya reembolsada

EFECTOS:
✅ Cambia status de la venta
✅ Restaura stock de TODOS los items (cantidad negativa)
✅ Registra razón del reembolso
✅ Logs para debugging

EJEMPLO DE USO:
SELECT fn_cancel_refund_sale(
  'sale-uuid-here'::uuid,
  'refunded'::sale_status,
  'Cliente insatisfecho con el producto'
);
*/