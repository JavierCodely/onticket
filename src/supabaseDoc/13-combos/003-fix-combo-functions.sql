-- ===========================================================
-- FIX: RECREAR FUNCIONES DE COMBOS CON PARÁMETROS CORRECTOS
-- ===========================================================

-- Eliminar funciones existentes con todas las posibles firmas
DROP FUNCTION IF EXISTS public.fn_create_combo(text, numeric, jsonb, text, integer, integer, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_combo(text, text, numeric, integer, integer, integer, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_combo(uuid, text, text, numeric, integer, integer, integer, integer, combo_status) CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_combo(uuid, text, text, numeric, integer, integer, integer, combo_status) CASCADE;

-- Recrear fn_create_combo con los parámetros correctos
CREATE OR REPLACE FUNCTION public.fn_create_combo(
  p_name text,
  p_combo_price numeric,
  p_combo_items jsonb,  -- Array de {product_id, quantity_per_combo}
  p_description text DEFAULT NULL,
  p_stock_quantity integer DEFAULT 0,
  p_min_combo_per_client integer DEFAULT 1,
  p_max_combo_per_client integer DEFAULT 1,
  p_max_uses integer DEFAULT NULL
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
  -- Verificar que es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden crear combos';
  END IF;

  -- Validaciones básicas
  IF p_combo_price <= 0 THEN
    RAISE EXCEPTION 'El precio del combo debe ser mayor a 0';
  END IF;

  IF p_min_combo_per_client <= 0 THEN
    RAISE EXCEPTION 'El mínimo por cliente debe ser mayor a 0';
  END IF;

  IF p_max_combo_per_client < p_min_combo_per_client THEN
    RAISE EXCEPTION 'El máximo por cliente debe ser mayor o igual al mínimo';
  END IF;

  -- Validar que hay al menos 2 productos en el combo
  IF jsonb_array_length(p_combo_items) < 2 THEN
    RAISE EXCEPTION 'Un combo debe tener al menos 2 productos';
  END IF;

  -- Crear el combo principal
  INSERT INTO public.combos (
    club_id,
    name,
    description,
    combo_price,
    stock_quantity,
    min_combo_per_client,
    max_combo_per_client,
    max_uses,
    created_by,
    updated_by
  ) VALUES (
    v_club_id,
    p_name,
    p_description,
    p_combo_price,
    p_stock_quantity,
    p_min_combo_per_client,
    p_max_combo_per_client,
    p_max_uses,
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_combo_id;

  -- Agregar los items del combo
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_combo_items)
  LOOP
    -- Validar cantidad
    IF (v_item->>'quantity_per_combo')::integer <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0 para el producto %', v_item->>'product_id';
    END IF;

    -- Verificar que el producto existe y pertenece al club
    IF NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE id = (v_item->>'product_id')::uuid
        AND club_id = v_club_id
        AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Producto % no encontrado o inactivo', v_item->>'product_id';
    END IF;

    -- Insertar item del combo
    INSERT INTO public.combo_items (
      combo_id,
      product_id,
      quantity_per_combo,
      display_order
    ) VALUES (
      v_combo_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity_per_combo')::integer,
      v_display_order
    );

    v_display_order := v_display_order + 1;
  END LOOP;

  RETURN v_combo_id;
END;
$$;

-- Recrear fn_update_combo con los parámetros correctos
CREATE OR REPLACE FUNCTION public.fn_update_combo(
  p_combo_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_combo_price numeric DEFAULT NULL,
  p_stock_quantity integer DEFAULT NULL,
  p_min_combo_per_client integer DEFAULT NULL,
  p_max_combo_per_client integer DEFAULT NULL,
  p_max_uses integer DEFAULT NULL,
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
  -- Verificar que es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden actualizar combos';
  END IF;

  -- Obtener combo actual
  SELECT * INTO v_combo
  FROM public.combos
  WHERE id = p_combo_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Combo no encontrado';
  END IF;

  -- Validaciones
  IF p_combo_price IS NOT NULL AND p_combo_price <= 0 THEN
    RAISE EXCEPTION 'El precio del combo debe ser mayor a 0';
  END IF;

  IF p_min_combo_per_client IS NOT NULL AND p_min_combo_per_client <= 0 THEN
    RAISE EXCEPTION 'El mínimo por cliente debe ser mayor a 0';
  END IF;

  IF p_max_combo_per_client IS NOT NULL AND p_min_combo_per_client IS NOT NULL AND p_max_combo_per_client < p_min_combo_per_client THEN
    RAISE EXCEPTION 'El máximo por cliente debe ser mayor o igual al mínimo';
  END IF;

  IF p_max_combo_per_client IS NOT NULL AND p_min_combo_per_client IS NULL AND p_max_combo_per_client < v_combo.min_combo_per_client THEN
    RAISE EXCEPTION 'El máximo por cliente debe ser mayor o igual al mínimo actual';
  END IF;

  -- Actualizar combo
  UPDATE public.combos
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    combo_price = COALESCE(p_combo_price, combo_price),
    stock_quantity = COALESCE(p_stock_quantity, stock_quantity),
    min_combo_per_client = COALESCE(p_min_combo_per_client, min_combo_per_client),
    max_combo_per_client = COALESCE(p_max_combo_per_client, max_combo_per_client),
    max_uses = CASE
      WHEN p_max_uses = -1 THEN NULL  -- -1 significa sin límite
      ELSE COALESCE(p_max_uses, max_uses)
    END,
    status = COALESCE(p_status, status),
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_combo_id;

  RETURN TRUE;
END;
$$;

-- Verificar que se crearon correctamente
SELECT
  '✅ FUNCIONES CREADAS' as resultado,
  p.proname as funcion,
  pg_get_function_arguments(p.oid) as parametros
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('fn_create_combo', 'fn_update_combo')
ORDER BY p.proname;
