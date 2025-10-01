-- =========================================================================
-- DEBUG PARA CONTADOR DE COMBOS - FUNCIÓN MEJORADA CON LOGS
-- =========================================================================

-- Crear una función de debug para ver el estado de los combos
CREATE OR REPLACE FUNCTION public.fn_debug_combo_state(p_combo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_combo record;
  v_current_uses integer := 0;
BEGIN
  -- Obtener información del combo
  SELECT * INTO v_combo
  FROM public.combos
  WHERE id = p_combo_id;

  -- Calcular usos actuales desde el log
  SELECT COALESCE(SUM(combo_quantity), 0) INTO v_current_uses
  FROM public.combo_usage_log
  WHERE combo_id = p_combo_id;

  -- Construir resultado de debug
  v_result := jsonb_build_object(
    'combo_exists', (v_combo.id IS NOT NULL),
    'combo_name', COALESCE(v_combo.name, 'N/A'),
    'combo_status', COALESCE(v_combo.status::text, 'N/A'),
    'total_usage_limit', COALESCE(v_combo.total_usage_limit, -1),
    'current_uses_calculated', v_current_uses,
    'is_limit_reached', (v_combo.total_usage_limit IS NOT NULL AND v_current_uses >= v_combo.total_usage_limit),
    'usage_log_entries', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'usage_date', usage_date,
          'combo_quantity', combo_quantity,
          'employee_name', employee_name,
          'sale_id', sale_id
        ) ORDER BY usage_date DESC
      )
      FROM public.combo_usage_log
      WHERE combo_id = p_combo_id
      LIMIT 10
    ),
    'view_data', (
      SELECT jsonb_build_object(
        'current_uses_from_view', current_uses,
        'is_available_from_view', is_available,
        'effective_stock', effective_stock
      )
      FROM public.combos_with_details
      WHERE id = p_combo_id
    )
  );

  RETURN v_result;
END;
$$;

-- Mejorar la función fn_use_combo con mejores logs
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
  v_current_uses_before integer := 0;
  v_current_uses_after integer := 0;
BEGIN
  -- Log inicial
  RAISE NOTICE '🔄 fn_use_combo iniciado para combo: %, cantidad: %, venta: %',
    p_combo_id, p_combo_quantity, COALESCE(p_sale_id::text, 'NULL');

  -- Verificar permisos
  v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());
  IF v_club_id IS NULL THEN
    RAISE NOTICE '❌ Sin permisos para usar combos';
    RETURN false;
  END IF;

  -- Obtener combo
  SELECT * INTO v_combo FROM public.combos
  WHERE id = p_combo_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE NOTICE '❌ Combo no encontrado: %', p_combo_id;
    RETURN false;
  END IF;

  -- Calcular usos actuales antes
  SELECT COALESCE(SUM(combo_quantity), 0) INTO v_current_uses_before
  FROM public.combo_usage_log WHERE combo_id = p_combo_id;

  RAISE NOTICE '📊 Estado antes del uso - Combo: %, Usos actuales: %, Límite: %',
    v_combo.name, v_current_uses_before, COALESCE(v_combo.total_usage_limit, -1);

  -- Validar stock antes de proceder
  v_validation_result := fn_validate_combo_stock(p_combo_id, p_combo_quantity);
  IF NOT (v_validation_result->>'valid')::boolean THEN
    RAISE NOTICE '❌ Validación fallida: %', v_validation_result->>'errors';
    RETURN false;
  END IF;

  -- Decrementar stock de productos individuales
  FOR v_item IN
    SELECT ci.*, p.name
    FROM public.combo_items ci
    LEFT JOIN public.products p ON p.id = ci.product_id AND p.club_id = v_club_id
    WHERE ci.combo_id = p_combo_id
  LOOP
    RAISE NOTICE '📦 Actualizando stock de producto: % (cantidad: %)',
      COALESCE(v_item.name, v_item.product_id::text), v_item.quantity_per_combo * p_combo_quantity;

    -- Actualizar stock del producto individual
    PERFORM fn_update_product_stock(
      v_item.product_id,
      v_item.quantity_per_combo * p_combo_quantity
    );
  END LOOP;

  -- CLAVE: Registrar uso en log ANTES de verificar de nuevo
  INSERT INTO public.combo_usage_log (
    combo_id, sale_id, customer_identifier, employee_id, employee_name,
    combo_quantity, unit_price, total_price
  ) VALUES (
    p_combo_id, p_sale_id, p_customer_identifier, auth.uid(), p_employee_name,
    p_combo_quantity, v_combo.combo_price, v_combo.combo_price * p_combo_quantity
  );

  -- Calcular usos después
  SELECT COALESCE(SUM(combo_quantity), 0) INTO v_current_uses_after
  FROM public.combo_usage_log WHERE combo_id = p_combo_id;

  RAISE NOTICE '✅ Registro de uso completado - Combo: %, Usos después: %, Límite: %',
    v_combo.name, v_current_uses_after, COALESCE(v_combo.total_usage_limit, -1);

  -- Verificar si llegó al límite
  IF v_combo.total_usage_limit IS NOT NULL AND v_current_uses_after >= v_combo.total_usage_limit THEN
    RAISE NOTICE '⚠️ LÍMITE ALCANZADO - Combo: % ya no estará disponible (usos: %/%)',
      v_combo.name, v_current_uses_after, v_combo.total_usage_limit;
  END IF;

  RETURN true;
END;
$$;

-- Función para resetear contador de un combo (útil para testing)
CREATE OR REPLACE FUNCTION public.fn_reset_combo_usage(p_combo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_deleted_count integer;
BEGIN
  -- Solo admins pueden resetear
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden resetear contadores';
  END IF;

  -- Verificar que el combo existe y pertenece al club
  IF NOT EXISTS (SELECT 1 FROM public.combos WHERE id = p_combo_id AND club_id = v_club_id) THEN
    RAISE EXCEPTION 'Combo no encontrado';
  END IF;

  -- Eliminar todos los registros de uso
  DELETE FROM public.combo_usage_log WHERE combo_id = p_combo_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Reseteo completado: % registros eliminados para combo %', v_deleted_count, p_combo_id;

  RETURN true;
END;
$$;

-- Dar permisos para la función de debug
GRANT EXECUTE ON FUNCTION public.fn_debug_combo_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reset_combo_usage(uuid) TO authenticated;

SELECT '🎯 Funciones de debug de combos creadas exitosamente' as resultado;