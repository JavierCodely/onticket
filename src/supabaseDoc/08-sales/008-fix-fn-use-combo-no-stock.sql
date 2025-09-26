-- =======================================================
-- SOLUCIÓN DEFINITIVA: EVITAR DOBLE DESCUENTO DE STOCK
-- =======================================================
-- Modificar fn_use_combo para que NO actualice stock de productos
-- Solo registre el uso del combo en combo_usage_log
-- El stock ya se descuenta en el loop principal de items

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
  v_validation_result jsonb;
BEGIN
  v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());
  IF v_club_id IS NULL THEN
    RETURN false;
  END IF;

  -- Validar combo antes de proceder
  v_validation_result := fn_validate_combo_stock(p_combo_id, p_combo_quantity);
  IF NOT (v_validation_result->>'valid')::boolean THEN
    RAISE NOTICE 'Validación de combo fallida: %', v_validation_result->>'errors';
    -- No fallar, solo logear - el stock ya fue validado en la función principal
  END IF;

  -- Obtener información del combo
  SELECT * INTO v_combo FROM public.combos
  WHERE id = p_combo_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Combo no encontrado: %', p_combo_id;
    RETURN false;
  END IF;

  -- NO ACTUALIZAR STOCK DE PRODUCTOS INDIVIDUALES
  -- El stock ya se actualizó en la función principal
  RAISE NOTICE 'fn_use_combo: NO actualizando stock (ya se hizo en función principal)';

  -- SOLO REGISTRAR USO EN LOG
  INSERT INTO public.combo_usage_log (
    combo_id, sale_id, customer_identifier, employee_id, employee_name,
    combo_quantity, unit_price, total_price
  ) VALUES (
    p_combo_id, p_sale_id, p_customer_identifier, auth.uid(), p_employee_name,
    p_combo_quantity, v_combo.combo_price, v_combo.combo_price * p_combo_quantity
  );

  RAISE NOTICE 'fn_use_combo: Combo % registrado en log (cantidad: %)', p_combo_id, p_combo_quantity;

  RETURN true;
END;
$$;

-- =======================================================
-- COMENTARIOS
-- =======================================================
/*
CAMBIO PRINCIPAL:

ANTES:
- fn_use_combo actualizaba stock de productos individuales
- La función principal TAMBIÉN actualizaba stock
- RESULTADO: Doble descuento

AHORA:
- fn_use_combo SOLO registra el uso en combo_usage_log
- La función principal actualiza stock de productos individuales
- RESULTADO: Un solo descuento

FLUJO CORRECTO:
1. Función principal (fn_create_sale_as_employee_with_combos) valida y actualiza stock
2. fn_use_combo SOLO registra el uso para tracking
3. Stock se descuenta una sola vez
*/