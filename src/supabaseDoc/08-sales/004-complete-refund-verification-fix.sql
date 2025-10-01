-- ===========================================================
-- VERIFICACIÓN Y CORRECCIÓN COMPLETA DEL SISTEMA DE REEMBOLSOS
-- ===========================================================
-- Script para verificar y corregir todo el sistema de reembolsos

-- ========================================
-- PASO 1: VERIFICAR ESTADO ACTUAL
-- ========================================

-- 1.1) Verificar si las funciones existen
DO $$
BEGIN
  RAISE NOTICE '=== VERIFICACIÓN DE FUNCIONES ===';

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_update_product_stock') THEN
    RAISE NOTICE '✅ fn_update_product_stock EXISTS';
  ELSE
    RAISE NOTICE '❌ fn_update_product_stock MISSING';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_cancel_refund_sale') THEN
    RAISE NOTICE '✅ fn_cancel_refund_sale EXISTS';
  ELSE
    RAISE NOTICE '❌ fn_cancel_refund_sale MISSING';
  END IF;
END $$;

-- 1.2) Verificar tipos ENUM
DO $$
BEGIN
  RAISE NOTICE '=== VERIFICACIÓN DE TIPOS ===';

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_status') THEN
    RAISE NOTICE '✅ sale_status ENUM EXISTS';
  ELSE
    RAISE NOTICE '❌ sale_status ENUM MISSING';
  END IF;
END $$;

-- ========================================
-- PASO 2: CREAR/CORREGIR FUNCIÓN DE STOCK
-- ========================================

-- 2.1) Función de stock que maneja reembolsos correctamente
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

  -- Actualizar o insertar stock
  INSERT INTO public.product_stock (
    product_id,
    club_id,
    current_stock,
    last_sale_date,
    updated_by,
    created_at,
    updated_at
  )
  VALUES (
    p_product_id,
    v_club_id,
    v_new_stock,
    CASE WHEN NOT v_is_refund THEN NOW() ELSE NULL END,
    auth.uid(),
    NOW(),
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

-- ========================================
-- PASO 3: CREAR/CORREGIR FUNCIÓN DE REEMBOLSO
-- ========================================

-- 3.1) Función de reembolso completa
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
  v_items_count integer := 0;
BEGIN
  RAISE NOTICE 'INICIANDO REEMBOLSO: Venta %, Acción %, Razón %', p_sale_id, p_action, p_reason;

  -- Check if current user is admin
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  RAISE NOTICE 'Usuario es admin: %', v_is_admin;

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

  RAISE NOTICE 'Venta encontrada: %, Status actual: %', v_sale_record.sale_number, v_sale_record.status;

  -- Permission checks
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id
    FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active';

    v_can_edit := (v_club_id = v_sale_record.club_id);
    RAISE NOTICE 'Club admin: %, Club venta: %, Puede editar: %', v_club_id, v_sale_record.club_id, v_can_edit;
  ELSE
    v_can_edit := false;
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'Solo los administradores pueden cancelar o reembolsar ventas';
  END IF;

  -- Can't cancel/refund already cancelled/refunded sales
  IF v_sale_record.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'No se puede cancelar/reembolsar una venta que ya está % (estado actual: %)',
      v_sale_record.status, v_sale_record.status;
  END IF;

  -- Update sale status FIRST
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
        -- Continuar con otros productos, no fallar todo el reembolso
    END;
  END LOOP;

  RAISE NOTICE 'REEMBOLSO COMPLETADO: Venta % - % items procesados',
    v_sale_record.sale_number, v_items_count;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR EN REEMBOLSO: %', SQLERRM;
    RAISE;
END;
$$;

-- ========================================
-- PASO 4: CONFIGURAR PERMISOS
-- ========================================

-- 4.1) Dar permisos a las funciones
GRANT EXECUTE ON FUNCTION public.fn_update_product_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cancel_refund_sale(uuid, sale_status, text) TO authenticated;

-- ========================================
-- PASO 5: VERIFICACIÓN FINAL
-- ========================================

-- 5.1) Verificar que todo esté correctamente instalado
DO $$
DECLARE
  v_test_sale_id uuid;
  v_test_product_id uuid;
  v_test_result boolean;
BEGIN
  RAISE NOTICE '=== VERIFICACIÓN FINAL ===';

  -- Verificar funciones existen
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_update_product_stock') THEN
    RAISE NOTICE '✅ fn_update_product_stock instalada correctamente';
  ELSE
    RAISE NOTICE '❌ fn_update_product_stock NO instalada';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_cancel_refund_sale') THEN
    RAISE NOTICE '✅ fn_cancel_refund_sale instalada correctamente';
  ELSE
    RAISE NOTICE '❌ fn_cancel_refund_sale NO instalada';
  END IF;

  -- Mostrar ventas disponibles para testing
  RAISE NOTICE '=== VENTAS DISPONIBLES PARA TESTING ===';
  FOR v_test_sale_id IN
    SELECT id FROM public.sales
    WHERE status = 'completed'
    LIMIT 3
  LOOP
    RAISE NOTICE 'Venta disponible para reembolso: %', v_test_sale_id;
  END LOOP;

  RAISE NOTICE '=== INSTALACIÓN COMPLETADA ===';
  RAISE NOTICE 'Para probar reembolso, ejecutar:';
  RAISE NOTICE 'SELECT fn_cancel_refund_sale(''venta-uuid''::uuid, ''refunded''::sale_status, ''Test'');';
END $$;

-- ========================================
-- INSTRUCCIONES DE USO
-- ========================================

/*
🎯 SCRIPT DE VERIFICACIÓN Y CORRECCIÓN COMPLETA

ESTE SCRIPT:
✅ Verifica que todas las funciones existan
✅ Crea/actualiza fn_update_product_stock con manejo correcto de reembolsos
✅ Crea/actualiza fn_cancel_refund_sale con logs detallados
✅ Configura permisos correctos
✅ Proporciona verificación final

DESPUÉS DE EJECUTAR:
1. Revisar los logs de NOTICE para ver el estado
2. Probar reembolso con una venta real
3. Verificar que el stock se actualice correctamente

PARA DEBUGGING:
- Los logs NOTICE aparecen en el panel de logs de Supabase
- Cada operación está loggeada para troubleshooting
- Los errores se capturan y reportan específicamente

TESTING:
SELECT fn_cancel_refund_sale(
  'uuid-de-venta-real'::uuid,
  'refunded'::sale_status,
  'Testing del sistema de reembolsos'
);
*/