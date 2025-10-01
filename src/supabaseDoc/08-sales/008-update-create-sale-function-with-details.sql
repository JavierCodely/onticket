-- ========================================
-- ACTUALIZAR FUNCIÓN fn_create_sale PARA INCLUIR CAMPO DETAILS
-- ========================================
-- Actualiza la función de creación de ventas para manejar el campo details

-- Eliminar función existente
DROP FUNCTION IF EXISTS public.fn_create_sale(uuid, text, jsonb, payment_method, jsonb, numeric, text) CASCADE;

-- Recrear función con soporte para el campo details
CREATE OR REPLACE FUNCTION public.fn_create_sale(
  p_employee_user_id uuid,              -- ID del empleado que aparecerá en la venta
  p_employee_name text,                 -- Nombre del empleado
  p_items jsonb,                        -- Array de items: [{"product_id": "uuid", "quantity": 2, "unit_price": 10.50}]
  p_payment_method payment_method,      -- Método de pago
  p_payment_details jsonb DEFAULT NULL, -- Detalles del pago
  p_discount_amount numeric DEFAULT 0,  -- Descuento
  p_notes text DEFAULT NULL,            -- Notas
  p_details jsonb DEFAULT NULL          -- NUEVO: Detalles de la venta (descuentos manuales, promociones, combos, etc.)
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_club_id uuid;
  v_sale_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product record;
  v_line_total numeric;
  v_employee_category text;
  v_current_user_role text;
BEGIN
  -- Verificar que el usuario actual es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden crear ventas';
  END IF;

  -- Validar datos de entrada
  IF p_employee_name IS NULL OR trim(p_employee_name) = '' THEN
    RAISE EXCEPTION 'El nombre del empleado es requerido';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe incluir al menos un item en la venta';
  END IF;

  -- Verificar que el empleado existe y pertenece al club
  IF p_employee_user_id IS NOT NULL THEN
    -- Verificar si es admin
    SELECT 'admin' INTO v_employee_category
    FROM public.admins
    WHERE user_id = p_employee_user_id AND club_id = v_club_id AND status = 'active';

    -- Si no es admin, verificar si es empleado
    IF v_employee_category IS NULL THEN
      SELECT category::text INTO v_employee_category
      FROM public.employees
      WHERE user_id = p_employee_user_id AND club_id = v_club_id AND status = 'active';
    END IF;

    IF v_employee_category IS NULL THEN
      RAISE EXCEPTION 'El empleado seleccionado no existe o no pertenece a este club';
    END IF;
  ELSE
    v_employee_category := 'manual';
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

    -- Verificar stock disponible
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

  -- Crear la venta
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
    details,  -- NUEVO: Agregar campo details
    created_by,
    updated_by
  ) VALUES (
    v_club_id,
    v_sale_number,
    COALESCE(p_employee_user_id, auth.uid()),
    p_employee_name,
    v_employee_category,
    v_subtotal,
    COALESCE(p_discount_amount, 0),
    v_total,
    p_payment_method,
    p_payment_details,
    p_notes,
    p_details,  -- NUEVO: Valor para campo details
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

    -- Actualizar stock del producto
    PERFORM fn_update_product_stock(
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer
    );
  END LOOP;

  -- Log de la transacción
  RAISE NOTICE 'Venta creada: % - Total: %', v_sale_number, v_total;

  RETURN v_sale_id;
END;
$$;

-- ========================================
-- ACTUALIZAR FUNCIÓN fn_update_sale PARA INCLUIR CAMPO DETAILS
-- ========================================

-- Eliminar función existente de actualización
DROP FUNCTION IF EXISTS public.fn_update_sale(uuid, uuid, text, payment_method, jsonb, numeric, text, sale_status, text) CASCADE;

-- Recrear función con soporte para el campo details
CREATE OR REPLACE FUNCTION public.fn_update_sale(
  p_sale_id uuid,
  p_employee_user_id uuid DEFAULT NULL,
  p_employee_name text DEFAULT NULL,
  p_payment_method payment_method DEFAULT NULL,
  p_payment_details jsonb DEFAULT NULL,
  p_discount_amount numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_details jsonb DEFAULT NULL,          -- NUEVO: Detalles de la venta
  p_status sale_status DEFAULT NULL,
  p_refund_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale record;
  v_club_id uuid;
  v_employee_category text;
  v_old_total numeric;
  v_new_total numeric;
BEGIN
  -- Verificar que el usuario actual es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden editar ventas';
  END IF;

  -- Obtener venta actual
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Verificar empleado si se proporciona
  IF p_employee_user_id IS NOT NULL THEN
    -- Verificar si es admin
    SELECT 'admin' INTO v_employee_category
    FROM public.admins
    WHERE user_id = p_employee_user_id AND club_id = v_club_id AND status = 'active';

    -- Si no es admin, verificar si es empleado
    IF v_employee_category IS NULL THEN
      SELECT category::text INTO v_employee_category
      FROM public.employees
      WHERE user_id = p_employee_user_id AND club_id = v_club_id AND status = 'active';
    END IF;

    IF v_employee_category IS NULL THEN
      RAISE EXCEPTION 'El empleado seleccionado no existe o no pertenece a este club';
    END IF;
  END IF;

  v_old_total := v_sale.total_amount;

  -- Actualizar venta
  UPDATE public.sales
  SET
    employee_id = COALESCE(p_employee_user_id, employee_id),
    employee_name = COALESCE(p_employee_name, employee_name),
    employee_category = COALESCE(v_employee_category, employee_category),
    payment_method = COALESCE(p_payment_method, payment_method),
    payment_details = COALESCE(p_payment_details, payment_details),
    discount_amount = COALESCE(p_discount_amount, discount_amount),
    total_amount = subtotal - COALESCE(p_discount_amount, discount_amount),
    notes = COALESCE(p_notes, notes),
    details = COALESCE(p_details, details),  -- NUEVO: Actualizar campo details
    status = COALESCE(p_status, status),
    refund_reason = CASE
      WHEN p_status = 'refunded' THEN COALESCE(p_refund_reason, refund_reason)
      ELSE refund_reason
    END,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_sale_id
  RETURNING total_amount INTO v_new_total;

  RAISE NOTICE 'Venta actualizada: % - Nuevo total: %', v_sale.sale_number, v_new_total;

  RETURN TRUE;
END;
$$;

-- ========================================
-- COMENTARIOS DE USO ACTUALIZADO
-- ========================================

/*
EJEMPLOS DE USO ACTUALIZADO:

1. CREAR VENTA CON DETALLES:
SELECT fn_create_sale(
  'uuid-del-empleado'::uuid,
  'Juan Pérez',
  '[
    {"product_id": "uuid-product-1", "quantity": 2, "unit_price": 10.50},
    {"product_id": "uuid-product-2", "quantity": 1}
  ]'::jsonb,
  'cash',
  null,
  5.00,
  'Descuento especial',
  '{
    "discounts": {
      "manual_discount": {
        "applied": true,
        "amount": 5.00,
        "reason": "Cliente frecuente",
        "applied_by": "Juan Pérez"
      }
    },
    "special_conditions": {
      "employee_sale": false,
      "vip_customer": true
    }
  }'::jsonb
);

2. ACTUALIZAR VENTA CON DETALLES:
SELECT fn_update_sale(
  'uuid-venta'::uuid,
  'uuid-nuevo-empleado'::uuid,
  'María González',
  'transfer',
  null,
  0,
  'Sin descuento',
  '{
    "discounts": {
      "manual_discount": {
        "applied": false
      }
    }
  }'::jsonb
);
*/