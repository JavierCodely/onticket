-- ===========================================================
-- FIX: DOBLE ACTUALIZACIÓN DE STOCK EN COMBOS
-- ===========================================================
-- Corrige el problema donde se actualiza el stock dos veces:
-- 1. En el loop de items individuales
-- 2. En fn_use_combo
--
-- La solución es NO actualizar stock de productos que son parte de combos
-- en el primer loop, solo dejar que fn_use_combo lo haga.

-- ========================================
-- PASO 1: CORREGIR FUNCIÓN DE EMPLEADOS
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_create_sale_as_employee_with_combos(
  p_items jsonb,                        -- Array de items: [{"product_id": "uuid", "quantity": 2, "unit_price": 10.50}]
  p_payment_method payment_method,      -- Método de pago
  p_combos_used jsonb DEFAULT '[]'::jsonb, -- Array de combos: [{"combo_id": "uuid", "quantity": 1}]
  p_payment_details jsonb DEFAULT NULL, -- Detalles del pago
  p_discount_amount numeric DEFAULT 0,  -- Descuento
  p_notes text DEFAULT NULL             -- Notas
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_club_id uuid;
  v_employee record;
  v_sale_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_combo jsonb;
  v_product record;
  v_line_total numeric;
  v_combo_id uuid;
  v_combo_quantity integer;
  v_combo_products uuid[]; -- Array de productos que son parte de combos
BEGIN
  -- Verificar que el usuario actual es un empleado activo
  v_club_id := fn_current_employee_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo empleados activos pueden crear ventas';
  END IF;

  -- Obtener información del empleado actual
  SELECT e.*, COALESCE(a.full_name, e.full_name) as employee_name,
         CASE WHEN a.user_id IS NOT NULL THEN 'admin' ELSE e.category::text END as employee_category
  INTO v_employee
  FROM public.employees e
  LEFT JOIN public.admins a ON a.user_id = e.user_id AND a.status = 'active'
  WHERE e.user_id = auth.uid()
    AND e.status = 'active'
    AND e.club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado no encontrado o inactivo';
  END IF;

  -- Validar datos de entrada
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe incluir al menos un item en la venta';
  END IF;

  -- CREAR LISTA DE PRODUCTOS QUE SON PARTE DE COMBOS
  IF jsonb_array_length(p_combos_used) > 0 THEN
    SELECT array_agg(DISTINCT ci.product_id) INTO v_combo_products
    FROM jsonb_array_elements(p_combos_used) AS combo_data
    JOIN public.combo_items ci ON ci.combo_id = (combo_data->>'combo_id')::uuid;

    RAISE NOTICE 'Productos que son parte de combos: %', v_combo_products;
  ELSE
    v_combo_products := '{}'; -- Array vacío
  END IF;

  -- Generar número de venta
  v_sale_number := fn_generate_sale_number(v_club_id);

  -- Validar y calcular totales
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Verificar que el producto existe y pertenece al club
    SELECT p.*, COALESCE(ps.available_stock, 0) as available_stock
    INTO v_product
    FROM public.products p
    LEFT JOIN public.product_stock ps ON ps.product_id = p.id
    WHERE p.id = (v_item->>'product_id')::uuid
      AND p.club_id = v_club_id
      AND p.status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado o inactivo: %', v_item->>'product_id';
    END IF;

    -- Verificar stock disponible SOLO para productos que NO son parte de combos
    -- Los productos de combos se validarán en fn_validate_combo_stock
    IF NOT ((v_item->>'product_id')::uuid = ANY(v_combo_products)) THEN
      IF v_product.available_stock < (v_item->>'quantity')::integer THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto: % (disponible: %)',
          v_product.name, v_product.available_stock;
      END IF;
    END IF;

    -- Usar precio del item o precio del producto
    v_line_total := COALESCE((v_item->>'unit_price')::numeric, v_product.sale_price) * (v_item->>'quantity')::integer;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  -- Calcular total final
  v_total := v_subtotal - COALESCE(p_discount_amount, 0);

  IF v_total < 0 THEN
    RAISE EXCEPTION 'El total de la venta no puede ser negativo';
  END IF;

  -- VALIDAR COMBOS ANTES DE PROCEDER
  IF jsonb_array_length(p_combos_used) > 0 THEN
    FOR v_combo IN SELECT * FROM jsonb_array_elements(p_combos_used)
    LOOP
      v_combo_id := (v_combo->>'combo_id')::uuid;
      v_combo_quantity := (v_combo->>'quantity')::integer;

      -- Validar cada combo
      DECLARE
        v_combo_validation jsonb;
      BEGIN
        v_combo_validation := fn_validate_combo_stock(v_combo_id, v_combo_quantity);
        IF NOT (v_combo_validation->>'valid')::boolean THEN
          RAISE EXCEPTION 'Error de validación del combo %: %',
            v_combo_id, v_combo_validation->>'errors';
        END IF;
      END;
    END LOOP;
  END IF;

  -- Crear la venta usando el empleado actual
  INSERT INTO public.sales (
    club_id,
    sale_number,
    employee_id,
    employee_name,
    employee_category,
    subtotal,
    discount_amount,
    total_amount,
    payment_method,
    payment_details,
    notes,
    created_by,
    updated_by
  ) VALUES (
    v_club_id,
    v_sale_number,
    auth.uid(), -- Siempre usa el usuario actual (empleado)
    v_employee.employee_name,
    v_employee.employee_category,
    v_subtotal,
    COALESCE(p_discount_amount, 0),
    v_total,
    p_payment_method,
    p_payment_details,
    p_notes,
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_sale_id;

  -- Crear items de venta y actualizar stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Obtener información del producto
    SELECT p.name, p.sku, p.category::text
    INTO v_product
    FROM public.products p
    WHERE p.id = (v_item->>'product_id')::uuid;

    -- Insertar item de venta
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
      v_sale_id,
      (v_item->>'product_id')::uuid,
      v_product.name,
      v_product.sku,
      v_product.category,
      COALESCE((v_item->>'unit_price')::numeric, (SELECT sale_price FROM public.products WHERE id = (v_item->>'product_id')::uuid)),
      (v_item->>'quantity')::integer,
      COALESCE((v_item->>'unit_price')::numeric, (SELECT sale_price FROM public.products WHERE id = (v_item->>'product_id')::uuid)) * (v_item->>'quantity')::integer
    );

    -- SOLO actualizar stock de productos que NO son parte de combos
    -- Los productos de combos se actualizarán en fn_use_combo
    IF NOT ((v_item->>'product_id')::uuid = ANY(v_combo_products)) THEN
      PERFORM fn_update_product_stock(
        (v_item->>'product_id')::uuid,
        (v_item->>'quantity')::integer
      );
      RAISE NOTICE 'Stock actualizado para producto individual: %', v_item->>'product_id';
    ELSE
      RAISE NOTICE 'Stock NO actualizado para producto de combo (se hará en fn_use_combo): %', v_item->>'product_id';
    END IF;
  END LOOP;

  -- PROCESAR COMBOS UTILIZADOS
  IF jsonb_array_length(p_combos_used) > 0 THEN
    FOR v_combo IN SELECT * FROM jsonb_array_elements(p_combos_used)
    LOOP
      v_combo_id := (v_combo->>'combo_id')::uuid;
      v_combo_quantity := (v_combo->>'quantity')::integer;

      -- Registrar uso del combo (esto actualizará el stock de productos del combo)
      PERFORM fn_use_combo(
        v_combo_id,
        v_combo_quantity,
        v_sale_id,
        NULL, -- customer_identifier
        v_employee.employee_name
      );

      RAISE NOTICE 'Combo usado: % (cantidad: %) en venta %', v_combo_id, v_combo_quantity, v_sale_id;
    END LOOP;
  END IF;

  -- Log de la transacción
  RAISE NOTICE 'Venta creada por empleado: % - Empleado: % - Total: % - Combos: %',
    v_sale_number, v_employee.employee_name, v_total, jsonb_array_length(p_combos_used);

  RETURN v_sale_id;
END;
$$;

-- ========================================
-- COMENTARIOS
-- ========================================

/*
CAMBIOS REALIZADOS:

1. CREAR LISTA DE PRODUCTOS DE COMBOS:
   - Se crea v_combo_products con todos los product_id que forman parte de combos
   - Se hace antes de procesar items

2. VALIDACIÓN DE STOCK SELECTIVA:
   - Solo se valida stock de productos que NO son parte de combos
   - Los productos de combos se validan en fn_validate_combo_stock

3. ACTUALIZACIÓN DE STOCK SELECTIVA:
   - Solo se actualiza stock de productos que NO son parte de combos
   - Los productos de combos se actualizan en fn_use_combo

FLUJO CORREGIDO:
1. Identificar productos que son parte de combos
2. Validar stock solo de productos individuales
3. Validar combos con fn_validate_combo_stock
4. Crear venta con items
5. Actualizar stock solo de productos individuales
6. Procesar combos con fn_use_combo (que actualiza stock de productos del combo)

ESTO EVITA LA DOBLE ACTUALIZACIÓN DE STOCK.
*/