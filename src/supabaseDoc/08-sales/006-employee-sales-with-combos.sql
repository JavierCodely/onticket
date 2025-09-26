-- ===========================================================
-- FUNCIÓN ACTUALIZADA PARA VENTAS DE EMPLEADOS CON COMBOS
-- ===========================================================
-- Actualiza fn_create_sale_as_employee para soportar combos

-- ========================================
-- PASO 1: CREAR FUNCIÓN MEJORADA CON COMBOS
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

    -- Verificar stock disponible (solo si no forma parte de un combo)
    -- El stock de combos se valida por separado
    IF v_product.available_stock < (v_item->>'quantity')::integer THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto: % (disponible: %)',
        v_product.name, v_product.available_stock;
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

    -- Actualizar stock del producto (fn_use_combo ya lo hará para items de combo)
    PERFORM fn_update_product_stock(
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer
    );
  END LOOP;

  -- PROCESAR COMBOS UTILIZADOS
  IF jsonb_array_length(p_combos_used) > 0 THEN
    FOR v_combo IN SELECT * FROM jsonb_array_elements(p_combos_used)
    LOOP
      v_combo_id := (v_combo->>'combo_id')::uuid;
      v_combo_quantity := (v_combo->>'quantity')::integer;

      -- Registrar uso del combo
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
-- PASO 2: FUNCIÓN DE RETROCOMPATIBILIDAD
-- ========================================

-- Actualizar la función original para usar la nueva función
CREATE OR REPLACE FUNCTION public.fn_create_sale_as_employee(
  p_items jsonb,                        -- Array de items: [{"product_id": "uuid", "quantity": 2, "unit_price": 10.50}]
  p_payment_method payment_method,      -- Método de pago
  p_payment_details jsonb DEFAULT NULL, -- Detalles del pago
  p_discount_amount numeric DEFAULT 0,  -- Descuento
  p_notes text DEFAULT NULL             -- Notas
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Llamar a la nueva función sin combos para mantener retrocompatibilidad
  RETURN fn_create_sale_as_employee_with_combos(
    p_items,
    p_payment_method,
    '[]'::jsonb, -- Sin combos
    p_payment_details,
    p_discount_amount,
    p_notes
  );
END;
$$;

-- ========================================
-- COMENTARIOS DE USO
-- ========================================

/*
EJEMPLOS DE USO:

1. CREAR VENTA CON COMBOS:
SELECT fn_create_sale_as_employee_with_combos(
  '[
    {"product_id": "uuid-product-1", "quantity": 2, "unit_price": 10.50},
    {"product_id": "uuid-product-2", "quantity": 1}
  ]'::jsonb,
  'cash',
  '[
    {"combo_id": "664ba5c9-dbff-47f6-8110-d969a2ba199e", "quantity": 1}
  ]'::jsonb,
  null,
  5.00,
  'Venta con combo'
);

2. CREAR VENTA SIN COMBOS (usa función original):
SELECT fn_create_sale_as_employee(
  '[
    {"product_id": "uuid-product-1", "quantity": 2, "unit_price": 10.50}
  ]'::jsonb,
  'cash'
);

FLUJO DE PROCESAMIENTO:
1. Se valida el stock de productos individuales
2. Se valida el stock de combos con fn_validate_combo_stock
3. Se crea la venta con items individuales
4. Se procesa cada combo con fn_use_combo que:
   - Actualiza stock de productos del combo
   - Registra uso en combo_usage_log
   - Incrementa current_uses del combo
5. Se completa la transacción

IMPORTANTE:
- Los items que se envían deben ser SOLO los productos individuales (sin combo displays)
- Los combos se envían por separado en p_combos_used
- fn_use_combo maneja automáticamente el stock y conteo de usos
*/